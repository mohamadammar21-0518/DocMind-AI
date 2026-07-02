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
        raise NotImplementedError(
            "QueryLogger is a stub — implement in task 8.1"
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
        raise NotImplementedError

    def tail(self, n: int = 50) -> list[dict[str, Any]]:
        """
        Return the *n* most recent records from the log file as a list of
        plain dicts (deserialized from JSONL).

        Returns an empty list if the log file does not exist or is empty.
        """
        raise NotImplementedError
