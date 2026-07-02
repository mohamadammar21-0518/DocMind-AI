"""
test_session_store.py — Unit and property-based tests for SessionStore.

Feature: rag-production-hardening, Task 3.1
"""

import os
import tempfile
from datetime import datetime, timedelta, timezone

import pytest
from hypothesis import given, settings, HealthCheck, strategies as st

from session_store import SessionStore, StorageUnavailableError


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture()
def tmp_db_path(tmp_path):
    """Return a temporary SQLite database URL for test isolation."""
    db_file = tmp_path / "test_sessions.db"
    return f"sqlite:///{db_file}"


@pytest.fixture()
def session_store(tmp_db_path):
    """Return a SessionStore instance backed by a temporary database."""
    return SessionStore(db_url=tmp_db_path)


# ── Hypothesis Strategies ─────────────────────────────────────────────────────


@st.composite
def session_record_strategy(draw):
    """Generate arbitrary session records for property-based testing."""
    return {
        "pdf_names": draw(st.lists(st.text(min_size=1, max_size=20), min_size=1, max_size=5)),
        "num_pages": draw(st.integers(min_value=0, max_value=10000)),
        "num_chunks": draw(st.integers(min_value=0, max_value=50000)),
        "chat_history": draw(
            st.lists(
                st.fixed_dictionaries({
                    "role": st.sampled_from(["user", "assistant"]),
                    "content": st.text(min_size=1, max_size=100),
                }),
                min_size=0,
                max_size=10,
            )
        ),
        "collection_name": draw(st.one_of(st.none(), st.text(min_size=1, max_size=50))),
        "is_fallback": draw(st.booleans()),
    }


# ── Unit Tests ────────────────────────────────────────────────────────────────


def test_sessionstore_init_creates_schema(tmp_db_path):
    """SessionStore.__init__ should create the sessions table and index."""
    store = SessionStore(db_url=tmp_db_path)
    # Verify table exists by attempting a query
    result = store.load_all()
    assert isinstance(result, list)
    assert len(result) == 0


def test_sessionstore_init_with_invalid_url_raises():
    """SessionStore.__init__ should raise StorageUnavailableError on bad URL."""
    with pytest.raises(StorageUnavailableError, match="Could not connect"):
        SessionStore(db_url="invalid://not_a_real_url")


def test_sessionstore_save_insert_new_record(session_store):
    """save() should insert a new record with created_at and updated_at timestamps."""
    session_id = "test-session-001"
    record = {
        "pdf_names": ["doc1.pdf", "doc2.pdf"],
        "num_pages": 42,
        "num_chunks": 300,
        "chat_history": [{"role": "user", "content": "Hello"}],
        "collection_name": "pdf_test-session-001",
        "is_fallback": False,
    }

    session_store.save(session_id, record)

    loaded = session_store.load(session_id)
    assert loaded is not None
    assert loaded["session_id"] == session_id
    assert loaded["pdf_names"] == ["doc1.pdf", "doc2.pdf"]
    assert loaded["num_pages"] == 42
    assert loaded["num_chunks"] == 300
    assert loaded["chat_history"] == [{"role": "user", "content": "Hello"}]
    assert loaded["collection_name"] == "pdf_test-session-001"
    assert loaded["is_fallback"] is False
    assert isinstance(loaded["created_at"], datetime)
    assert isinstance(loaded["updated_at"], datetime)


def test_sessionstore_save_update_existing_record(session_store):
    """save() should update an existing record and refresh updated_at."""
    session_id = "test-session-002"
    record = {
        "pdf_names": ["initial.pdf"],
        "num_pages": 10,
        "num_chunks": 50,
        "chat_history": [],
        "collection_name": "initial_collection",
        "is_fallback": False,
    }

    session_store.save(session_id, record)
    first_load = session_store.load(session_id)
    created_at_original = first_load["created_at"]

    # Update the record
    record["pdf_names"].append("updated.pdf")
    record["num_pages"] = 20
    record["chat_history"] = [{"role": "user", "content": "Updated"}]
    session_store.save(session_id, record)

    second_load = session_store.load(session_id)
    assert second_load["pdf_names"] == ["initial.pdf", "updated.pdf"]
    assert second_load["num_pages"] == 20
    assert second_load["chat_history"] == [{"role": "user", "content": "Updated"}]
    # created_at should be unchanged, updated_at should be newer
    assert second_load["created_at"] == created_at_original
    assert second_load["updated_at"] >= created_at_original


def test_sessionstore_load_nonexistent_returns_none(session_store):
    """load() should return None for a session ID that does not exist."""
    result = session_store.load("does-not-exist")
    assert result is None


def test_sessionstore_load_all_returns_all_sessions(session_store):
    """load_all() should return a list of all session dicts."""
    records = [
        ("sess-1", {"pdf_names": ["a.pdf"], "num_pages": 1, "num_chunks": 10}),
        ("sess-2", {"pdf_names": ["b.pdf"], "num_pages": 2, "num_chunks": 20}),
        ("sess-3", {"pdf_names": ["c.pdf"], "num_pages": 3, "num_chunks": 30}),
    ]
    for sid, rec in records:
        session_store.save(sid, rec)

    all_sessions = session_store.load_all()
    assert len(all_sessions) == 3
    session_ids = {s["session_id"] for s in all_sessions}
    assert session_ids == {"sess-1", "sess-2", "sess-3"}


def test_sessionstore_purge_old_deletes_only_old_records(session_store):
    """purge_old(days=30) should delete only records with updated_at older than 30 days."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Create records with varying ages
    old_record = {
        "pdf_names": ["old.pdf"],
        "num_pages": 1,
        "num_chunks": 10,
        "collection_name": "old_collection",
        "is_fallback": False,
    }
    recent_record = {
        "pdf_names": ["recent.pdf"],
        "num_pages": 2,
        "num_chunks": 20,
        "collection_name": "recent_collection",
        "is_fallback": False,
    }

    # Save old session (we'll manually adjust updated_at)
    session_store.save("old-session", old_record)
    # Save recent session
    session_store.save("recent-session", recent_record)

    # Manually backdate the old session's updated_at by 31 days
    with session_store._Session() as db_session:
        from session_store import SessionRecord
        old_row = db_session.get(SessionRecord, "old-session")
        old_row.updated_at = now - timedelta(days=31)
        db_session.commit()

    # Purge records older than 30 days
    deleted_count = session_store.purge_old(days=30)
    assert deleted_count == 1

    # Verify old session is gone, recent session remains
    assert session_store.load("old-session") is None
    assert session_store.load("recent-session") is not None


def test_sessionstore_purge_old_returns_zero_when_no_old_records(session_store):
    """purge_old() should return 0 when there are no records older than the threshold."""
    session_store.save("new-session", {"pdf_names": [], "num_pages": 0, "num_chunks": 0})
    deleted_count = session_store.purge_old(days=30)
    assert deleted_count == 0


# ── Property-Based Tests ──────────────────────────────────────────────────────


# Module-level shared store for property tests — avoids creating a new DB per example
_PROP_TEST_DIR = tempfile.mkdtemp()
_PROP_STORE = SessionStore(db_url=f"sqlite:///{_PROP_TEST_DIR}/prop_test.db")


@given(
    session_id=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_categories=("Cs",))),
    record=session_record_strategy(),
)
@settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_property_session_store_round_trip(session_id, record):
    """
    Property 2: Session Store Round-Trip

    For any valid session record, after calling save() and then load(), the returned
    record should equal the saved record in all fields.

    **Validates: Requirements 2.1, 2.2**
    """
    _PROP_STORE.save(session_id, record)
    loaded = _PROP_STORE.load(session_id)

    assert loaded is not None
    assert loaded["session_id"] == session_id
    assert loaded["pdf_names"] == record["pdf_names"]
    assert loaded["num_pages"] == record["num_pages"]
    assert loaded["num_chunks"] == record["num_chunks"]
    assert loaded["chat_history"] == record["chat_history"]
    assert loaded["collection_name"] == record["collection_name"]
    assert loaded["is_fallback"] == record["is_fallback"]
    assert isinstance(loaded["created_at"], datetime)
    assert isinstance(loaded["updated_at"], datetime)


@given(
    session_records=st.lists(
        st.tuples(
            st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd"))),
            st.integers(min_value=0, max_value=100),  # days_old
        ),
        min_size=3,
        max_size=8,
        unique_by=lambda x: x[0],  # unique session_ids within the list
    ),
    purge_threshold=st.integers(min_value=10, max_value=50),
)
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow],
)
def test_property_session_purge_correctness(session_records, purge_threshold):
    """
    Property 3: Session Purge Correctness

    For any set of session records with distinct updated_at timestamps, after calling
    purge_old(days=N), the returned deleted count should equal the number of records
    older than N days, and every record within N days should still be retrievable.

    **Validates: Requirements 2.5**
    """
    # Use in-memory SQLite per example — fast and fully isolated, avoids cross-example contamination
    store = SessionStore(db_url="sqlite:///:memory:")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    expected_deleted = 0
    expected_remaining = []

    for session_id, days_old in session_records:
        record = {
            "pdf_names": ["test.pdf"],
            "num_pages": 1,
            "num_chunks": 10,
            "collection_name": session_id[:30],
            "is_fallback": False,
        }
        store.save(session_id, record)

        # Backdate with a ±1 day margin to avoid race conditions on the exact boundary.
        # Records clearly older than threshold → store at days_old + 1 (definitely past cutoff)
        # Records clearly newer than threshold → store at days_old - 1 (definitely before cutoff)
        if days_old > purge_threshold:
            stored_days = days_old + 1  # push further into the past to ensure deletion
            expected_deleted += 1
        else:
            stored_days = max(0, days_old - 1)  # pull towards present to ensure survival
            expected_remaining.append(session_id)

        with store._Session() as db_session:
            from session_store import SessionRecord as _SR
            row = db_session.get(_SR, session_id)
            row.updated_at = now - timedelta(days=stored_days)
            db_session.commit()

    # Execute purge and verify returned count
    deleted_count = store.purge_old(days=purge_threshold)
    assert deleted_count == expected_deleted

    # Verify remaining records are still present
    for sid in expected_remaining:
        assert store.load(sid) is not None, f"Expected {sid} to survive purge but it was deleted"
