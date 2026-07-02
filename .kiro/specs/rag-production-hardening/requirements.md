# Requirements Document

## Introduction

DocMind AI currently operates with ephemeral in-memory state: vector stores and sessions are stored in process memory and lost on every Cloud Run scale-to-zero event. Several reliability, observability, cost, and quality gaps have been identified for a production hardening pass. This document captures requirements for seven improvement areas: persistent storage, embedding fallback transparency, reranking cost reduction, automated testing, query observability, abuse protection, and documentation polish.

## Glossary

- **Backend**: The FastAPI Python 3.11 service running on Google Cloud Run.
- **Session**: A per-user context object keyed by browser UUID that holds the QA chain, uploaded PDF names, page count, and chunk count.
- **Session_Store**: The persistence layer for Session data (currently a Python `dict` in process memory).
- **Vector_Store**: The ChromaDB instance that holds document chunk embeddings for a given Session.
- **Embedding_Service**: The component in `rag_core.py` that converts text into numerical vectors (`all-MiniLM-L6-v2` real model or `LightweightEmbedding` fallback).
- **Fallback_Mode**: The operating state where `LightweightEmbedding` (hash-based, 64-dim) is used instead of `all-MiniLM-L6-v2` (semantic, 384-dim) due to memory pressure or import failure.
- **Hybrid_Retriever**: The component that merges BM25 keyword results and vector similarity results before reranking.
- **Reranker**: The component that scores and reorders retrieved document chunks by relevance to a user query.
- **Cross_Encoder_Reranker**: A local, lightweight neural reranker (e.g., `cross-encoder/ms-marco-MiniLM-L-6-v2`) that scores query–chunk pairs without an LLM API call.
- **LLM_Reranker**: The current Groq `llama-3.1-8b-instant`-based reranker that scores chunks via an API call.
- **Query_Log**: A durable, append-only record of each query event containing: session ID, query text, retrieved chunks with scores, reranked order, final answer, and timestamp.
- **RAGAS_Baseline**: A stored snapshot of RAGAS metric scores (faithfulness, answer relevancy, context precision) used as a regression reference in tests.
- **Rate_Limiter**: The middleware component that enforces request-frequency limits on the `/upload` and `/chat` endpoints.
- **Architecture_Diagram**: A pipeline flowchart in the README that depicts the full upload and query flows end-to-end.

---

## Requirements

### Requirement 1: Persistent Vector Store

**User Story:** As a user, I want my uploaded documents to survive a Cloud Run scale-to-zero event, so that I do not need to re-upload PDFs after the container restarts.

#### Acceptance Criteria

1. WHEN the Backend starts, THE Vector_Store SHALL load from durable storage (local persistent disk volume or a managed vector database) rather than an in-process EphemeralClient.
2. WHEN a new PDF is uploaded and indexed, THE Vector_Store SHALL write the resulting embeddings and metadata to durable storage before returning a success response to the client; IF the durable write fails after embedding, THE Backend SHALL return an HTTP 500-level error and SHALL NOT return a success response.
3. WHEN the Backend restarts after a scale-to-zero event, THE Vector_Store SHALL make all previously indexed collections available — meaning they respond to similarity-search queries by collection name — without requiring a re-upload.
4. IF durable storage is unavailable at startup, THEN THE Backend SHALL log an error message that includes the storage path and the reason for failure, and return HTTP 503 on all `/upload` and `/chat` requests until storage becomes available.
5. THE Vector_Store SHALL support at least 10,000 chunk embeddings per collection without degrading similarity search latency beyond 500 ms on a 1 vCPU Cloud Run allocation.

---

### Requirement 2: Persistent Session and Chat History

**User Story:** As a user, I want my session state and chat history to survive container restarts, so that I can resume a conversation after a Cloud Run cold start without losing context.

#### Acceptance Criteria

1. WHEN a Session is created or updated, THE Session_Store SHALL write the session record (session ID, PDF names, page count, chunk count, and chat history) to a relational database (SQLite for local development, PostgreSQL for production) and the write SHALL complete within 2 seconds before returning a response.
2. WHEN the Backend restarts, THE Session_Store SHALL reload all sessions that have at least one non-expired persisted record from the database so that `/session/{session_id}` returns the correct state for any previously created session.
3. WHEN a user sends a chat message to an existing session after a container restart, THE Backend SHALL reconstruct the QA chain from the persisted session metadata and Vector_Store data and respond without requiring re-upload; IF the Vector_Store data for that session is missing, THE Backend SHALL return HTTP 400 with an error message instructing the user to re-upload their documents.
4. IF the database is unreachable at request time, THEN THE Session_Store SHALL return HTTP 503, and SHALL NOT silently degrade to in-memory state.
5. THE Session_Store SHALL expose an on-demand purge endpoint that deletes session records older than 30 days and returns a count of deleted records; a scheduled cleanup job SHALL also call this purge logic daily, so that the database does not grow unboundedly.

---

### Requirement 3: Embedding Fallback Visibility

**User Story:** As a user, I want to know when the system is using a degraded embedding mode, so that I can understand why retrieval quality may be lower than expected.

#### Acceptance Criteria

1. WHEN the Embedding_Service activates Fallback_Mode during a PDF upload, THE Backend SHALL include a `"fallback_embedding": true` field in the `/upload` response JSON.
2. WHEN the `/upload` response contains `"fallback_embedding": true`, THE Frontend SHALL display a warning banner in the upload confirmation area using caution (not danger/error) styling; the banner SHALL remain visible until the user dismisses it or uploads a new document.
3. WHEN the Embedding_Service is operating with the real `all-MiniLM-L6-v2` model, THE Backend SHALL include `"fallback_embedding": false` in the `/upload` response JSON.
4. WHEN the `/upload` response contains `"fallback_embedding": false`, THE Frontend SHALL NOT display the fallback warning banner.
5. WHEN the `/chat/stream` endpoint serves a response in a session that used Fallback_Mode embeddings, THE Backend SHALL include `"fallback_embedding": true` in the `sources` SSE event payload, and THE Frontend SHALL display a warning indicator for the duration of that query response display.
6. IF the real `all-MiniLM-L6-v2` model fails to load, THEN THE Embedding_Service SHALL activate Fallback_Mode and the upload SHALL still complete successfully.

---

### Requirement 4: Cross-Encoder Reranking with LLM Escalation

**User Story:** As a user, I want queries to return relevant answers quickly and affordably, so that the system remains responsive and does not incur unnecessary Groq API costs on every query.

#### Acceptance Criteria

1. THE Reranker SHALL use a local Cross_Encoder_Reranker (e.g., `cross-encoder/ms-marco-MiniLM-L-6-v2`) as the default reranking strategy, requiring no external API call.
2. WHEN the reranking mode is set to `"high_accuracy"` for a query, THE Reranker SHALL escalate to the LLM_Reranker (Groq `llama-3.1-8b-instant`) and return the top 4 chunks in descending relevance order.
3. WHEN the Cross_Encoder_Reranker produces a top-chunk score below 4 (on the 0–10 scale) for a query, THE Reranker SHALL automatically escalate to the LLM_Reranker for that query.
4. WHEN the Backend caches a reranking result, THE Reranker SHALL return the cached result for queries whose text — after lowercasing and collapsing all whitespace to a single space — exactly matches a cached query key, within a TTL of 300 seconds, without calling the Cross_Encoder_Reranker or LLM_Reranker again.
5. IF the Cross_Encoder_Reranker fails to load at startup, THEN THE Reranker SHALL fall back to the LLM_Reranker, log a warning that includes the load error, and continue startup so the application remains operational.
6. IF the LLM_Reranker is invoked via escalation (C2 or C3) and the LLM call fails, THEN THE Reranker SHALL fall back to the Cross_Encoder_Reranker order and log the LLM error, without surfacing an error to the user.
7. WHEN a new PDF is uploaded, THE `/upload` response SHALL include a `"reranker"` field indicating which reranking strategy is active (`"cross_encoder"` or `"llm_judge"`).

---

### Requirement 5: Automated Test Suite

**User Story:** As a developer, I want an automated test suite covering chunking, hybrid retrieval, citation mapping, and RAGAS regression, so that retrieval quality regressions are caught before deployment.

#### Acceptance Criteria

1. THE Test_Suite SHALL include unit tests for the `load_and_split_multiple_pdfs` function that verify chunk boundaries, chunk overlap, and `source_file` metadata assignment for a multi-PDF input.
2. THE Test_Suite SHALL include unit tests for the `Hybrid_Retriever.invoke` method that verify BM25 and vector results are merged, deduplicated by the first 80 characters of content, and bounded to the value of `k` passed to `build_hybrid_retriever` at construction multiplied by 2.
3. THE Test_Suite SHALL include unit tests for the `rerank_documents` function that verify the output list length does not exceed `top_k`, that each returned document carries a `rerank_score` metadata value, and that an empty input list returns an empty output list.
4. THE Test_Suite SHALL include unit tests for the `ask` function's `sources` output field that verify the `page` field equals `metadata["page"] + 1` for each returned document.
5. THE Test_Suite SHALL include a RAGAS regression test that loads the RAGAS_Baseline metrics from a checked-in JSON file, runs the RAGAS evaluation on a fixed set of at least 5 test questions against a known document, and fails the test if any one of faithfulness, answer relevancy, or context precision drops more than 0.05 below the corresponding baseline value.
6. IF a non-empty chunk list of at least 1 chunk is provided to `build_vectorstore` and then queried with a string containing at least one whitespace-delimited word that appears in any stored chunk, THEN THE Vector_Store SHALL return a non-empty result set (round-trip property: index then retrieve finds something).
7. IF `Hybrid_Retriever.invoke` is called with any valid query string and `k` is set to 6, THEN the number of returned documents SHALL be less than or equal to 12 (metamorphic property: output size is bounded regardless of input size).

---

### Requirement 6: Query Observability Logging

**User Story:** As a developer, I want a durable log of each query's retrieved chunks, scores, and reranked order, so that I can debug incorrect answers after the fact without needing to reproduce the session.

#### Acceptance Criteria

1. WHEN a query is processed by the `/chat/stream` or `/chat` endpoint, THE Query_Log SHALL append one record containing: session ID, ISO-8601 timestamp, query text, list of raw retrieved chunks with best-effort origin label (`"bm25"`, `"vector"`, or `"both"`) and their content keys, reranked chunk order with scores (0–10, or null when LLM reranking is unavailable), the reranker strategy used, and the final answer text; for streaming responses, the log write SHALL occur after the full answer has been assembled, before the `done` SSE event is sent.
2. THE Query_Log SHALL persist records to a durable append-only store (a local JSONL file, SQLite table, or a dedicated logging database) that survives container restarts.
3. WHEN the query log store is unavailable, THE Backend SHALL proceed with answering the query and SHALL log a warning to stdout rather than returning an error to the user.
4. THE Backend SHALL expose a `GET /admin/query-logs` endpoint that returns the 50 most recent Query_Log records in JSON format, accessible only with a valid `ADMIN_API_KEY` header; WHEN a request arrives without a valid `ADMIN_API_KEY` header, THE endpoint SHALL return HTTP 401.
5. THE Query_Log record SHALL include a `"fallback_embedding"` boolean field so that log consumers can filter queries that used degraded embeddings.

---

### Requirement 7: Rate Limiting for Upload and Query Endpoints

**User Story:** As an operator, I want per-IP rate limits on the `/upload` and `/chat` endpoints, so that a single bad actor cannot exhaust the Groq API quota or Cloud Run CPU budget.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL enforce a limit of 10 `/upload` requests per IP address per 60-second sliding window.
2. THE Rate_Limiter SHALL enforce a limit of 30 `/chat` and `/chat/stream` requests per IP address per 60-second sliding window.
3. WHEN a request exceeds the rate limit, THE Backend SHALL return HTTP 429 with a JSON body containing an error message and a field indicating the whole number of seconds remaining until the current 60-second window expires.
4. WHEN a request is within the rate limit, THE Rate_Limiter SHALL add no more than 5 ms of overhead to the request processing time, measured at the 99th percentile across requests in a 60-second observation window.
5. IF the rate-limiting store (e.g., in-memory counter or Redis) is unavailable, THEN THE Backend SHALL allow the request to proceed and SHALL log a warning, so that a rate-limiter outage does not take down the application.
6. WHEN a request arrives through the Cloud Run load balancer with an `X-Forwarded-For` header present, THE Rate_Limiter SHALL use the leftmost IP address in that header as the client IP for rate-limit tracking.
7. IF the `X-Forwarded-For` header is absent, THEN THE Rate_Limiter SHALL use the direct connection IP as the client IP for rate-limit tracking.

---

### Requirement 8: Documentation — Architecture Diagram and Roadmap

**User Story:** As a new contributor or evaluator, I want an architecture diagram and a roadmap section in the README, so that I can understand the system's pipeline and its known constraints at a glance.

#### Acceptance Criteria

1. THE README SHALL contain a fenced plain-text code block using `→` arrows and stage labels that depicts the full upload pipeline (PDF → PyPDFLoader → RecursiveCharacterTextSplitter → Embedding_Service → Vector_Store) and the full query pipeline (query → Hybrid_Retriever → Reranker → ChatGroq → StreamingResponse).
2. THE README SHALL label each pipeline stage with the corresponding module or class name from the codebase (`PyPDFLoader`, `RecursiveCharacterTextSplitter`, `Embedding_Service`, `Vector_Store`, `Hybrid_Retriever`, `Reranker`, `ChatGroq`, `StreamingResponse`).
3. THE README SHALL contain a "Known Limitations" section that lists at minimum: session volatility on scale-to-zero, memory constraints on the Cloud Run free tier, RAGAS local-only restriction, and Groq rate-limit sleep delays.
4. THE README SHALL contain a "Roadmap" section listing the improvements from this production hardening spec: persistent storage, fallback visibility, cross-encoder reranking, automated tests, query observability, and rate limiting.
5. IF a configuration option is described in the README (e.g., `USE_LOCAL_MODELS`, `GROQ_API_KEY`), THEN THE README SHALL include the environment variable name, its default value, and a one-sentence description of its effect.
