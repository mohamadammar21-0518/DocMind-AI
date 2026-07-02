# Implementation Plan: RAG Production Hardening

## Overview

Transform DocMind AI from an ephemeral in-memory service into a production-hardened backend by implementing eight improvements incrementally: persistent storage (ChromaDB + SQLAlchemy sessions), embedding fallback visibility, cross-encoder reranking with LLM escalation, an automated test suite, query observability logging, per-IP rate limiting, and README documentation. Each task builds on the previous, ending with full integration and wiring.

## Tasks

- [x] 1. Set up infrastructure: dependencies, directory structure, and shared types
  - Add `sentence-transformers`, `sqlalchemy`, `apscheduler`, `httpx` to `backend/requirements.txt`
  - Add `pytest==8.3.0`, `hypothesis==6.115.0`, `pytest-asyncio==0.23.0`, `httpx==0.27.0` to a new `backend/requirements-dev.txt`
  - Create `backend/tests/__init__.py` and `backend/tests/conftest.py` with shared fixtures: `tmp_chroma_path`, `sample_chunks`, `sample_pdf_path`
  - Create stub files: `backend/session_store.py`, `backend/query_logger.py`, `backend/rate_limiter.py`
  - Add `CHROMA_PERSIST_DIR`, `DATABASE_URL`, and `ADMIN_API_KEY` env var entries to `backend/.env.example`
  - _Requirements: 1.1, 2.1, 5.1, 6.1, 7.1_

- [x] 2. Implement Persistent Vector Store
  - [x] 2.1 Replace `EphemeralClient` with `PersistentClient` in `rag_core.py`
    - Read `CHROMA_PERSIST_DIR` env var, defaulting to `/data/chroma_db`
    - Replace `_chromadb.EphemeralClient()` with `_chromadb.PersistentClient(path=CHROMA_DIR)` inside `build_vectorstore`
    - Add `session_id` parameter to `build_vectorstore`; namespace collections as `f"pdf_{session_id}"`
    - Implement `check_storage_health()` at module level; set `STORAGE_UNAVAILABLE = True` on failure; log path + reason
    - Update `main.py` `/upload` and `/chat` handlers to return HTTP 503 when `STORAGE_UNAVAILABLE` is `True`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 2.2 Write property test for vector store persistence round-trip (Property 1)
    - **Property 1: Vector Store Persistence Round-Trip**
    - **Validates: Requirements 1.2, 1.3, 5.6**
    - Use `hypothesis` strategies `lists(text(), min_size=1)` for chunks and `text()` for `session_id`
    - Assert similarity search returns non-empty results after client reload from same directory
    - File: `backend/tests/test_vectorstore.py`

  - [ ]* 2.3 Write unit tests for vector store
    - Test that `check_storage_health()` sets `STORAGE_UNAVAILABLE = True` when `PersistentClient` raises
    - Test that `/upload` returns HTTP 503 when `STORAGE_UNAVAILABLE = True`
    - Test that ChromaDB write failure after embedding returns HTTP 500 (not 200)
    - File: `backend/tests/test_vectorstore.py`
    - _Requirements: 1.2, 1.4_

- [x] 3. Implement SessionStore (`backend/session_store.py`)
  - [x] 3.1 Implement the `SessionStore` class with SQLAlchemy
    - Define `SessionRecord` ORM model with columns: `session_id`, `pdf_names`, `num_pages`, `num_chunks`, `chat_history`, `collection_name`, `is_fallback`, `created_at`, `updated_at`; add index on `updated_at`
    - Implement `SessionStore.__init__(db_url)`: create engine + tables; use SQLite for local dev, PostgreSQL for prod via `DATABASE_URL` env var
    - Implement `SessionStore.save(session_id, record)`: upsert session record; raise `StorageUnavailableError` on DB failure
    - Implement `SessionStore.load(session_id)`: return dict or `None`; raise `StorageUnavailableError` on DB failure
    - Implement `SessionStore.load_all()`: return list of all session dicts
    - Implement `SessionStore.purge_old(days=30)`: delete records older than threshold; return count deleted
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 3.2 Wire SessionStore into `main.py`
    - Instantiate `SessionStore` at app startup using `DATABASE_URL` env var
    - Replace the in-memory `sessions` dict with calls to `store.save()` and `store.load()` in `/upload`, `/chat`, `/chat/stream`, and `/session/{session_id}` handlers
    - Add `DELETE /admin/sessions/purge` endpoint calling `store.purge_old(30)`, returning `{"deleted": N}`
    - Schedule a daily APScheduler job to call `store.purge_old(30)`
    - Add FastAPI exception handler for `StorageUnavailableError` → HTTP 503
    - Handle `load()` returning `None` for missing VectorStore data → HTTP 400 "Please re-upload your documents"
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.3 Write property tests for SessionStore (Properties 2 and 3)
    - **Property 2: Session Store Round-Trip**
    - **Validates: Requirements 2.1, 2.2**
    - **Property 3: Session Purge Correctness**
    - **Validates: Requirements 2.5**
    - Use `fixed_dictionaries(...)` with `text()` and `integers()` for session fields; use random `updated_at` datetimes
    - Assert round-trip equality for all fields; assert purge count matches records older than 30 days and young records survive
    - File: `backend/tests/test_session_store.py`

  - [ ]* 3.4 Write unit tests for SessionStore edge cases
    - Test that `save()` raises `StorageUnavailableError` when DB is unreachable → HTTP 503 (no silent in-memory fallback)
    - Test that `load()` missing VectorStore data → HTTP 400 with correct message
    - Test write completes within 2 seconds
    - File: `backend/tests/test_session_store.py`
    - _Requirements: 2.3, 2.4_

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Embedding Fallback Visibility
  - [x] 5.1 Update `get_embeddings()` to return an `(embedding_fn, is_fallback: bool)` tuple
    - Change signature to `def get_embeddings() -> tuple[Any, bool]`
    - Return `(fn, False)` for the real model path; `(fn, True)` for the fallback path
    - Update all callers in `build_vectorstore` to unpack the tuple; propagate `is_fallback` in the return value
    - Include `is_fallback` in the `SessionRecord` written to `SessionStore`
    - Include `"fallback_embedding": bool` in the `/upload` response JSON
    - Include `"fallback_embedding": bool` in the `sources` SSE event payload in `/chat/stream`
    - _Requirements: 3.1, 3.3, 3.5, 3.6_

  - [ ] 5.2 Add fallback warning banner to `Sidebar.jsx`
    - Read `response.data.fallback_embedding` after successful upload
    - If `true`, render a dismissible `<div className="banner-warning">` with caution (amber/yellow) styling — not danger/error styling
    - Clear the banner on dismiss or when a new upload succeeds with `fallback_embedding: false`
    - _Requirements: 3.2, 3.4_

  - [ ] 5.3 Add per-query fallback indicator to `ChatTab.jsx`
    - On the `sources` SSE event, check `msg.sources?.fallback_embedding`
    - If `true`, display an inline warning badge for that query's response display duration
    - _Requirements: 3.5_

  - [ ]* 5.4 Write property test for embedding fallback flag consistency (Property 4)
    - **Property 4: Embedding Fallback Flag Consistency**
    - **Validates: Requirements 3.1, 3.3**
    - Patch `get_embeddings` to return `(LightweightEmbedding(), True)`; assert `/upload` response has `"fallback_embedding": true` and session record has `is_fallback = True`
    - File: `backend/tests/test_embedding_flag.py`

  - [ ]* 5.5 Write property test for upload response required fields (Property 6)
    - **Property 6: Upload Response Contains Required Fields**
    - **Validates: Requirements 3.1, 3.3, 4.7**
    - Use `booleans()` for `fallback_mode` and `text()` for `session_id`; assert response contains `"fallback_embedding"`, `"reranker"`, and `"session_id"` with correct types and allowed values
    - File: `backend/tests/test_upload_response.py`

  - [ ]* 5.6 Write unit tests for fallback visibility
    - Test real model failure → `fallback_embedding=true` in response and upload still returns 200
    - Test `USE_LOCAL_MODELS=false` → `fallback_embedding=true` on every upload
    - File: `backend/tests/test_embedding_flag.py`
    - _Requirements: 3.1, 3.6_

- [ ] 6. Implement Cross-Encoder Reranker with LLM Escalation
  - [x] 6.1 Implement `CrossEncoderReranker` class in `rag_core.py`
    - Add `CrossEncoderReranker` class with `MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"`
    - `__init__`: load model; on load failure log warning and set `self._available = False`
    - `score(query, docs)`: score all query–chunk pairs; populate `metadata["rerank_score"]` on each doc; return docs sorted descending by score
    - _Requirements: 4.1, 4.5_

  - [ ] 6.2 Update `rerank_documents` with new signature and decision logic
    - New signature: `rerank_documents(query, docs, top_k=4, mode="default", llm=None, cross_encoder=None, cache=None)`
    - Implement LRU rerank cache (`collections.OrderedDict`, max 1000 entries, 300 s TTL): normalize query (lowercase + collapse whitespace), check cache on entry, store on exit
    - Decision logic: `mode=="high_accuracy"` → LLM reranker directly; else run cross-encoder; if top score < 4 → escalate to LLM; if LLM fails → fall back to cross-encoder order + log error; if cross-encoder unavailable → use LLM; if both fail → dedup-only order
    - Add `"reranker"` field to `/upload` response: `"cross_encoder"` or `"llm_judge"` based on active strategy
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 6.3 Write property test for rerank cache idempotence (Property 5)
    - **Property 5: Rerank Cache Idempotence**
    - **Validates: Requirements 4.4**
    - Use `text()` queries with random whitespace/case variants; `lists(document_strategy())`; assert two calls within TTL yield identical results and underlying reranker invoked only once
    - File: `backend/tests/test_reranking.py`

  - [ ]* 6.4 Write property test for rerank documents invariants (Property 8)
    - **Property 8: Rerank Documents Invariants**
    - **Validates: Requirements 5.3**
    - Use `lists(document_strategy())` for docs and `integers(1, 8)` for `top_k`; assert output ≤ `top_k`, every doc has numeric `rerank_score` in metadata, empty input → empty output
    - File: `backend/tests/test_reranking.py`

  - [ ]* 6.5 Write unit tests for reranking edge cases
    - Test `mode="high_accuracy"` → LLM reranker called (mock LLM)
    - Test cross-encoder score < 4 → LLM escalation triggered
    - Test cross-encoder load failure → LLM used, warning logged
    - Test LLM failure during escalation → cross-encoder order returned, no user error
    - Test empty input list → empty output list
    - File: `backend/tests/test_reranking.py`
    - _Requirements: 4.2, 4.3, 4.5, 4.6_

- [ ] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Query Observability Logging (`backend/query_logger.py`)
  - [ ] 8.1 Implement `QueryLogger` with `QueryLogRecord` dataclass
    - Define `RawChunkRef`, `RankedChunkRef`, and `QueryLogRecord` dataclasses as specified in the design
    - Implement `QueryLogger.__init__(log_path)`: open/create `/data/query_log.jsonl` (path configurable via `QUERY_LOG_PATH` env var)
    - Implement `QueryLogger.append(record)`: thread-safe append to JSONL using a `threading.Lock`; serialize via `dataclasses.asdict()` + `json.dumps()`; wrap in `try/except` — on failure log warning to stdout and return, never propagate
    - Implement `QueryLogger.tail(n=50)`: read last `n` records from JSONL file; return as list of dicts
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 8.2 Wire `QueryLogger` into `/chat` and `/chat/stream` in `main.py`
    - Instantiate `QueryLogger` at app startup
    - In `/chat/stream`: after full answer is assembled, before the `done` SSE event, call `query_logger.append(...)` with all required fields including `fallback_embedding`, `raw_chunks` with origin labels, `reranked_chunks` with scores, `reranker_strategy`
    - In `/chat`: call `query_logger.append(...)` after `ask()` returns
    - Add `GET /admin/query-logs` endpoint: require `X-Admin-Api-Key: <ADMIN_API_KEY>` header; return HTTP 401 on missing/wrong key; return `{"logs": query_logger.tail(50)}`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 8.3 Write property test for query log record completeness (Property 10)
    - **Property 10: Query Log Record Completeness**
    - **Validates: Requirements 6.1, 6.5**
    - Use `text()` for `session_id`, `query`, `answer`; `booleans()` for `fallback`; assert exactly one record appended per call and record contains all required fields
    - File: `backend/tests/test_query_logger.py`

  - [ ]* 8.4 Write unit tests for query logger
    - Test log store write failure → query still answered, warning logged to stdout
    - Test `GET /admin/query-logs` without key → HTTP 401
    - Test `GET /admin/query-logs` with valid key after seeding 60 records → response contains exactly 50
    - File: `backend/tests/test_query_logger.py`
    - _Requirements: 6.3, 6.4_

- [ ] 9. Implement Rate Limiter (`backend/rate_limiter.py`)
  - [ ] 9.1 Implement `SlidingWindowRateLimiter` and `RateLimitMiddleware`
    - Implement `SlidingWindowRateLimiter.__init__(limit, window_seconds)`: create `_windows: dict[str, deque[float]]`
    - Implement `SlidingWindowRateLimiter.check(ip)`: evict timestamps outside window; if count ≥ limit return `(False, seconds_until_reset)`; else append current timestamp and return `(True, 0)`; wrap all operations in `try/except` — on error allow request and log warning
    - Implement `extract_client_ip(request)`: return leftmost token from `X-Forwarded-For` if present, else `request.client.host`
    - Implement `RateLimitMiddleware`: instantiate two limiters — upload (10 req/60 s) and chat (30 req/60 s); check correct limiter based on path; on rejection return `JSONResponse(status_code=429, content={"error": "Rate limit exceeded", "retry_after_seconds": N})`
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7_

  - [ ] 9.2 Register `RateLimitMiddleware` in `main.py`
    - Add `app.add_middleware(RateLimitMiddleware)` after the CORS middleware
    - _Requirements: 7.1, 7.2_

  - [ ]* 9.3 Write property test for rate limit enforcement (Property 11)
    - **Property 11: Rate Limit Enforcement**
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - Use an `ip_address_strategy()` composite strategy; send exactly `limit + 1` requests within window; assert first `limit` are allowed and `(limit + 1)`th returns 429 with `"error"` string and whole-number `"retry_after_seconds"`
    - File: `backend/tests/test_rate_limiter.py`

  - [ ]* 9.4 Write property test for X-Forwarded-For IP extraction (Property 12)
    - **Property 12: X-Forwarded-For IP Extraction**
    - **Validates: Requirements 7.6**
    - Use `lists(ip_address_strategy(), min_size=1)` joined by `", "`; assert `extract_client_ip` always returns the leftmost IP after stripping whitespace
    - File: `backend/tests/test_rate_limiter.py`

  - [ ]* 9.5 Write unit tests for rate limiter
    - Test rate limiter store failure → request allowed, warning logged
    - Test no `X-Forwarded-For` header → `request.client.host` used
    - Test p99 overhead < 5 ms: run 200 requests within limit, measure middleware time
    - File: `backend/tests/test_rate_limiter.py`
    - _Requirements: 7.4, 7.5, 7.7_

- [ ] 10. Implement Automated Test Suite (chunking, retrieval, citation, RAGAS)
  - [ ] 10.1 Write unit tests for `load_and_split_multiple_pdfs`
    - Test chunk boundaries: every chunk content length ≤ `chunk_size` chars (approximately)
    - Test chunk overlap: consecutive chunks from same document share ≥ `chunk_overlap` characters
    - Test `source_file` metadata: every chunk's `source_file` matches the origin PDF name
    - File: `backend/tests/test_chunking.py`
    - _Requirements: 5.1_

  - [ ]* 10.2 Write property test for chunking metadata invariants (Property 13)
    - **Property 13: Chunking Metadata Invariants**
    - **Validates: Requirements 5.1**
    - Use `lists(text(min_size=100))` for page contents; assert every chunk has `source_file` matching origin, content length ≤ `chunk_size`, consecutive same-doc chunks share ≥ `chunk_overlap` chars
    - File: `backend/tests/test_chunking.py`

  - [ ] 10.3 Write unit and property tests for `HybridRetriever`
    - Unit tests: verify BM25 and vector results are merged, deduplicated by first 80 chars, and output ≤ `k * 2`
    - File: `backend/tests/test_hybrid_retriever.py`
    - _Requirements: 5.2_

  - [ ]* 10.4 Write property test for hybrid retriever output size bound (Property 7)
    - **Property 7: Hybrid Retriever Output Size Bound**
    - **Validates: Requirements 5.2, 5.7**
    - Use `text()` query and `integers(min_value=1, max_value=10)` for `k`; assert output size ≤ `k * 2` and no two docs share first 80 chars
    - File: `backend/tests/test_hybrid_retriever.py`

  - [ ] 10.5 Write unit tests for `ask()` citation mapping
    - Build documents with explicit `page` metadata values; call `ask()`; assert every `sources[i]["page"] == chunk.metadata["page"] + 1`
    - File: `backend/tests/test_citation.py`
    - _Requirements: 5.4_

  - [ ]* 10.6 Write property test for source citation page offset (Property 9)
    - **Property 9: Source Citation Page Offset**
    - **Validates: Requirements 5.4**
    - Use `lists(document_strategy())` with random integer `page` metadata; assert `sources[i]["page"] == chunk.metadata["page"] + 1` for all returned sources
    - File: `backend/tests/test_citation.py`

  - [ ] 10.7 Create RAGAS baseline file and regression test
    - Create `backend/tests/ragas_baseline.json` with initial baseline scores (faithfulness, answer_relevancy, context_precision, recorded_at, test_document, num_questions)
    - Implement `test_ragas_baseline.py`: load baseline JSON, run RAGAS evaluation on ≥ 5 fixed questions against the sample document, assert no metric drops > 0.05 below baseline
    - File: `backend/tests/test_ragas_baseline.py`
    - _Requirements: 5.5_

- [ ] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Update README documentation
  - [ ] 12.1 Add Architecture section to `README.md`
    - Add `## Architecture` section with a fenced plain-text pipeline diagram using `→` arrows
    - Upload pipeline: `PDF → PyPDFLoader → RecursiveCharacterTextSplitter → Embedding_Service → Vector_Store`
    - Query pipeline: `query → Hybrid_Retriever → Reranker → ChatGroq → StreamingResponse`
    - Label each stage with the corresponding module/class name from the codebase
    - _Requirements: 8.1, 8.2_

  - [ ] 12.2 Add Known Limitations, Roadmap, and Configuration sections to `README.md`
    - Add `## Known Limitations` section listing: session volatility on scale-to-zero, memory constraints on Cloud Run free tier, RAGAS local-only restriction, Groq rate-limit sleep delays
    - Add `## Roadmap` section listing the eight hardening items from this spec
    - Add `## Configuration` table with env var names (`CHROMA_PERSIST_DIR`, `DATABASE_URL`, `ADMIN_API_KEY`, `USE_LOCAL_MODELS`, `GROQ_API_KEY`, `QUERY_LOG_PATH`), their default values, and one-sentence descriptions
    - _Requirements: 8.3, 8.4, 8.5_

- [ ] 13. Final integration and wiring
  - [ ] 13.1 Verify end-to-end wiring across all eight hardening areas
    - Confirm `main.py` imports and wires: `SessionStore`, `QueryLogger`, `RateLimitMiddleware`, `CrossEncoderReranker`, `check_storage_health()`
    - Confirm `/upload` response includes `fallback_embedding`, `reranker`, and `session_id` fields
    - Confirm `/chat/stream` SSE `sources` event includes `fallback_embedding`
    - Confirm `GET /admin/query-logs` and `DELETE /admin/sessions/purge` are registered
    - Confirm `RateLimitMiddleware` is added to the middleware stack
    - _Requirements: 1.1–1.4, 2.1–2.5, 3.1–3.6, 4.1–4.7, 6.1–6.5, 7.1–7.7_

  - [ ]* 13.2 Write integration test: end-to-end chat after restart
    - Upload a PDF, simulate restart by creating a new app instance pointing at the same DB and chroma dir, send a chat message, verify a non-empty answer is returned without re-uploading
    - File: `backend/tests/test_integration.py`
    - _Requirements: 2.2, 2.3_

  - [ ]* 13.3 Write integration test: ChromaDB 10k-chunk latency benchmark
    - Index 10,000 chunks into a persistent collection, time `similarity_search`, assert latency < 500 ms
    - File: `backend/tests/test_integration.py`
    - _Requirements: 1.5_

- [ ] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints at tasks 4, 7, 11, and 14 ensure incremental validation
- Property tests (P1–P13) validate universal correctness properties across arbitrary inputs; unit tests validate specific behaviors and edge cases
- The design document uses Python throughout; all code must target Python 3.11
- `requirements-dev.txt` is separate from `requirements.txt` to keep Cloud Run images lean
- The RAGAS regression test requires `ragas` and `datasets` to be installed and is intended for local developer runs, not CI by default

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "6.1"] },
    { "id": 3, "tasks": ["3.3", "3.4", "5.2", "5.3", "5.4", "5.5", "5.6", "6.2", "8.1"] },
    { "id": 4, "tasks": ["6.3", "6.4", "6.5", "8.2", "9.1", "10.1", "10.5"] },
    { "id": 5, "tasks": ["8.3", "8.4", "9.2", "10.2", "10.3", "10.6", "10.7"] },
    { "id": 6, "tasks": ["9.3", "9.4", "9.5", "10.4", "12.1"] },
    { "id": 7, "tasks": ["12.2", "13.1"] },
    { "id": 8, "tasks": ["13.2", "13.3"] }
  ]
}
```
