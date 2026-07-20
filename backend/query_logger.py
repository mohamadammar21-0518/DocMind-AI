"""
query_logger.py — Append-only JSONL query observability log for DocMind AI.

Each processed query results in one QueryLogRecord being appended to a
durable JSONL file (one JSON object per line).  The log path defaults to
/data/query_log.jsonl and can be overridden via the QUERY_LOG_PATH env var.
"""

from __future__ import annotations

import dataclasses
import json
import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


# ── Data classes ──────────────────────────────────────────────────────────────


@dataclasses.dataclass
class RawChunkRef:
    """Reference to a chunk as it was retrieved before reranking."""

    content_key: str   # First 80 characters of chunk content
    origin: str        # "bm25" | "vector" | "both"


@dataclasses.dataclass
class RankedChunkRef:
    """Reference to a chunk after reranking."""

    content_key: str
    score: float | None   # 0–10 from reranker, or null if unavailable


@dataclasses.dataclass
class QueryLogRecord:
    """A single query event record persisted to the JSONL log."""

    session_id: str
    timestamp: str           # ISO-8601 UTC
    query: str
    raw_chunks: list[RawChunkRef]
    reranked_chunks: list[RankedChunkRef]
    reranker_strategy: str   # "cross_encoder" | "llm_judge"
    answer: str
    fallback_embedding: bool


# ── QueryLogger ───────────────────────────────────────────────────────────────


class QueryLogger:
    """
    Thread-safe, append-only JSONL query logger.

    Usage::

        ql = QueryLogger("/data/query_log.jsonl")
        ql.append(record)
        recent = ql.tail(50)
    """

    def __init__(self, log_path: str | None = None) -> None:
        self._path = log_path or os.getenv(
            "QUERY_LOG_PATH", "/data/query_log.jsonl"
        )
        self._lock = threading.Lock()

        # Best-effort: ensure the parent directory exists.
        # If it doesn't (e.g. local dev without /data mount) we silently
        # degrade — log writes will warn but never crash the app.
        try:
            parent = os.path.dirname(self._path)
            if parent:
                os.makedirs(parent, exist_ok=True)
        except Exception as exc:
            logger.warning(
                "QueryLogger: could not create log directory '%s': %s",
                os.path.dirname(self._path),
                exc,
            )

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def append(self, record: QueryLogRecord) -> None:
        """
        Append *record* to the JSONL log file.

        Thread-safe.  Failures are caught, logged as warnings, and swallowed —
        a log write failure must never propagate to the caller.
        """
        try:
            # Serialise the dataclass to a flat dict.
            # Nested dataclasses (RawChunkRef / RankedChunkRef) are converted
            # via dataclasses.asdict so they land as plain dicts in the JSON.
            payload = dataclasses.asdict(record)

            line = json.dumps(payload, ensure_ascii=False)

            with self._lock:
                with open(self._path, "a", encoding="utf-8") as fh:
                    fh.write(line + "\n")

        except Exception as exc:
            logger.warning(
                "QueryLogger.append failed (record will be lost): %s", exc
            )

    def tail(self, n: int = 50) -> list[dict[str, Any]]:
        """
        Return the *n* most recent records from the log file as a list of
        plain dicts (deserialized from JSONL).

        Returns an empty list if the log file does not exist or is empty.
        """
        try:
            if not os.path.exists(self._path):
                return []

            with self._lock:
                with open(self._path, "r", encoding="utf-8") as fh:
                    lines = fh.readlines()

            # Take the last n non-empty lines
            recent_lines = [l.strip() for l in lines if l.strip()][-n:]

            records: list[dict[str, Any]] = []
            for line in recent_lines:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    logger.warning("QueryLogger.tail: skipping malformed line: %s", exc)

            return records

        except Exception as exc:
            logger.warning("QueryLogger.tail failed: %s", exc)
            return []


# ── Module-level singleton ────────────────────────────────────────────────────
# Imported and used by main.py:
#   from query_logger import query_logger, QueryLogRecord, RawChunkRef, RankedChunkRef

query_logger = QueryLogger()
