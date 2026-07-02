"""
session_store.py — Persistent session storage for DocMind AI.

Wraps SQLAlchemy to store session records in SQLite (local dev) or
PostgreSQL (production) based on the DATABASE_URL environment variable.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone, timedelta
from typing import Any

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    create_engine,
    Index,
    delete,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Session as DBSession, sessionmaker


# ── Exceptions ────────────────────────────────────────────────────────────────


class StorageUnavailableError(Exception):
    """Raised when the session database cannot be reached."""


# ── ORM Model ─────────────────────────────────────────────────────────────────


class Base(DeclarativeBase):
    pass


class SessionRecord(Base):
    """One row per user session."""

    __tablename__ = "sessions"

    session_id: str = Column(String, primary_key=True)
    pdf_names: str = Column(String, nullable=False, default="[]")  # JSON array
    num_pages: int = Column(Integer, nullable=False, default=0)
    num_chunks: int = Column(Integer, nullable=False, default=0)
    chat_history: str = Column(String, nullable=False, default="[]")  # JSON array
    collection_name: str = Column(String, nullable=True)
    is_fallback: bool = Column(Boolean, nullable=False, default=False)
    created_at: datetime = Column(DateTime, nullable=False)
    updated_at: datetime = Column(DateTime, nullable=False)

    __table_args__ = (
        Index("ix_sessions_updated_at", "updated_at"),
    )


# ── Helpers ───────────────────────────────────────────────────────────────────


def _record_to_dict(row: SessionRecord) -> dict[str, Any]:
    """Convert a SessionRecord ORM row to a plain dict with JSON-decoded fields."""
    return {
        "session_id": row.session_id,
        "pdf_names": json.loads(row.pdf_names) if row.pdf_names else [],
        "num_pages": row.num_pages,
        "num_chunks": row.num_chunks,
        "chat_history": json.loads(row.chat_history) if row.chat_history else [],
        "collection_name": row.collection_name,
        "is_fallback": row.is_fallback,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


# ── SessionStore ──────────────────────────────────────────────────────────────


class SessionStore:
    """
    Thin persistence layer for session records.

    Usage::

        store = SessionStore(db_url="sqlite:///./sessions.db")
        store.save("abc123", {"pdf_names": [...], ...})
        record = store.load("abc123")

    If *db_url* is ``None``, the value of the ``DATABASE_URL`` environment
    variable is used.  If that is also absent, defaults to a local SQLite
    file ``sqlite:///./sessions.db``.
    """

    def __init__(self, db_url: str | None = None) -> None:
        if db_url is None:
            db_url = os.getenv("DATABASE_URL", "sqlite:///./sessions.db")

        # SQLite needs check_same_thread=False for multi-threaded use
        connect_args: dict[str, Any] = {}
        if db_url.startswith("sqlite"):
            connect_args["check_same_thread"] = False

        try:
            self._engine = create_engine(db_url, connect_args=connect_args)
            Base.metadata.create_all(self._engine)
        except Exception as exc:
            raise StorageUnavailableError(
                f"Could not connect to session database at '{db_url}': {exc}"
            ) from exc

        self._Session = sessionmaker(bind=self._engine, expire_on_commit=False)

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def save(self, session_id: str, record: dict[str, Any]) -> None:
        """
        Upsert *record* under *session_id*.

        Raises:
            StorageUnavailableError: if the database cannot be reached.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # JSON-encode list fields before storage
        pdf_names = record.get("pdf_names", [])
        chat_history = record.get("chat_history", [])

        pdf_names_json = json.dumps(pdf_names) if isinstance(pdf_names, list) else pdf_names
        chat_history_json = (
            json.dumps(chat_history) if isinstance(chat_history, list) else chat_history
        )

        try:
            with self._Session() as session:
                existing: SessionRecord | None = session.get(SessionRecord, session_id)

                if existing is None:
                    # INSERT — set created_at for the first time
                    row = SessionRecord(
                        session_id=session_id,
                        pdf_names=pdf_names_json,
                        num_pages=record.get("num_pages", 0),
                        num_chunks=record.get("num_chunks", 0),
                        chat_history=chat_history_json,
                        collection_name=record.get("collection_name"),
                        is_fallback=record.get("is_fallback", False),
                        created_at=now,
                        updated_at=now,
                    )
                    session.add(row)
                else:
                    # UPDATE — preserve created_at, always refresh updated_at
                    existing.pdf_names = pdf_names_json
                    existing.num_pages = record.get("num_pages", existing.num_pages)
                    existing.num_chunks = record.get("num_chunks", existing.num_chunks)
                    existing.chat_history = chat_history_json
                    existing.collection_name = record.get(
                        "collection_name", existing.collection_name
                    )
                    existing.is_fallback = record.get("is_fallback", existing.is_fallback)
                    existing.updated_at = now

                session.commit()
        except StorageUnavailableError:
            raise
        except Exception as exc:
            raise StorageUnavailableError(
                f"Failed to save session '{session_id}': {exc}"
            ) from exc

    def load(self, session_id: str) -> dict[str, Any] | None:
        """
        Return the session dict for *session_id*, or ``None`` if not found.

        Raises:
            StorageUnavailableError: if the database cannot be reached.
        """
        try:
            with self._Session() as session:
                row: SessionRecord | None = session.get(SessionRecord, session_id)
                if row is None:
                    return None
                return _record_to_dict(row)
        except StorageUnavailableError:
            raise
        except Exception as exc:
            raise StorageUnavailableError(
                f"Failed to load session '{session_id}': {exc}"
            ) from exc

    def load_all(self) -> list[dict[str, Any]]:
        """
        Return all session records as a list of dicts.

        Raises:
            StorageUnavailableError: if the database cannot be reached.
        """
        try:
            with self._Session() as session:
                rows = session.execute(select(SessionRecord)).scalars().all()
                return [_record_to_dict(row) for row in rows]
        except StorageUnavailableError:
            raise
        except Exception as exc:
            raise StorageUnavailableError(
                f"Failed to load all sessions: {exc}"
            ) from exc

    def purge_old(self, days: int = 30) -> int:
        """
        Delete session records whose ``updated_at`` is older than *days* ago.

        Returns:
            The number of records deleted.

        Raises:
            StorageUnavailableError: if the database cannot be reached.
        """
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)

        try:
            with self._Session() as session:
                result = session.execute(
                    delete(SessionRecord).where(SessionRecord.updated_at < cutoff)
                )
                session.commit()
                return result.rowcount
        except StorageUnavailableError:
            raise
        except Exception as exc:
            raise StorageUnavailableError(
                f"Failed to purge old sessions: {exc}"
            ) from exc
