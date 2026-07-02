# DocMind AI

A cloud-native AI application that lets you chat with your PDF documents using natural language — powered by Groq Llama 3, LangChain, and ChromaDB, fully deployed on Google Cloud Run.

**Live App:** [docmind-frontend-817865882900.us-central1.run.app](https://docmind-frontend-817865882900.us-central1.run.app)  
**Backend API:** [docmind-backend-2jgx6au47a-uc.a.run.app](https://docmind-backend-2jgx6au47a-uc.a.run.app)

---

## Architecture

### Upload Pipeline

```
PDF file
    → PyPDFLoader          (text extraction, page-by-page)
    → RecursiveCharacterTextSplitter  (chunks: 800 chars, 100 overlap)
    → EmbeddingService     (all-MiniLM-L6-v2 / LightweightEmbedding fallback)
    → Vector_Store         (ChromaDB PersistentClient → /data/chroma_db)
    → SessionStore         (SQLite / PostgreSQL → /data/sessions.db)
```

### Query Pipeline

```
User query
    → RateLimiter          (per-IP sliding window)
    → HybridRetriever      (BM25 40% + Vector 60% → merged, deduplicated)
    → CrossEncoderReranker (cross-encoder/ms-marco-MiniLM-L-6-v2, local)
         └─ if top score < 4 → LLM Reranker (Groq llama-3.1-8b-instant)
    → ChatGroq             (llama-3.1-8b-instant / 70B / Gemma 2 9B)
    → StreamingResponse    (SSE, token-by-token)
    → QueryLogger          (JSONL → /data/query_log.jsonl)
```

---

## How It Works

### User Flow

1. Visit the app and sign in via Clerk authentication
2. Upload one or more PDFs through the sidebar
3. The backend extracts text, chunks it, generates embeddings, and writes them to persistent storage
4. Ask a question by typing or using the built-in mic
5. The backend runs hybrid search, reranks results locally, calls Groq, and streams the answer back
6. The answer arrives with page citations, a confidence score, and source snippets

### Session Management

Every browser generates a UUID on first visit, stored in `localStorage`. Serialisable session metadata (PDF names, page count, chunk count, chat history) is persisted to a SQLite/PostgreSQL database so sessions survive container restarts. The LangChain QA chain is kept in memory only; if the container restarts and the chain is gone, the app prompts the user to re-upload their documents.

Sessions older than 30 days are purged automatically by a daily background job.

---

## Features

- **Streaming Chat** — word-by-word SSE responses with page citations and confidence score
- **Persistent Storage** — vector store and session data survive Cloud Run scale-to-zero events
- **Hybrid Retrieval** — BM25 keyword + vector similarity search merged and deduplicated
- **Cross-Encoder Reranking** — local neural reranker by default; escalates to Groq only when confidence is low
- **Embedding Fallback Visibility** — warning banner shown when hash-based fallback embeddings are active
- **Query Observability** — every query logged to JSONL with chunks, scores, and reranker strategy
- **Rate Limiting** — per-IP sliding window on `/upload` (10 req/min) and `/chat` (30 req/min)
- **Smart Summarization** — Map-Reduce over every chunk for full-document coverage
- **Study Notes** — structured notes with key terms, examples, and practice questions
- **RAGAS Evaluation** — faithfulness, answer relevancy, and context precision scoring (local only)
- **Suggested Questions** — AI-generated questions based on document content
- **Multi-PDF Support** — upload and query across multiple documents in one session
- **Voice Input / TTS** — browser Web Speech API for dictation; answers can be read aloud
- **Export** — download results as Markdown, plain text, or PDF
- **Dark / Light Mode** — persisted per browser
- **Auth** — Clerk sign-in, isolated session per user

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Framer Motion, react-pdf, Clerk |
| Styling | CSS custom properties (design system), dark/light themes |
| Backend | FastAPI, Uvicorn, Python 3.11 |
| LLM | Groq API — Llama 3.1 8B / Llama 3.3 70B / Gemma 2 9B |
| RAG framework | LangChain, LangChain-Groq, LangChain-Community |
| Vector DB | ChromaDB PersistentClient (durable volume mount) |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` (384-dim); hash-based fallback (64-dim) |
| Keyword search | BM25 via rank-bm25 |
| Reranking | cross-encoder/ms-marco-MiniLM-L-6-v2 (local); Groq LLM escalation |
| Session store | SQLAlchemy — SQLite (dev) / PostgreSQL (prod) |
| Scheduling | APScheduler (daily session purge) |
| PDF parsing | PyPDF |
| Evaluation | RAGAS (local only) |
| Containerization | Docker |
| Deployment | Google Cloud Run (frontend + backend) |
| Auth | Clerk |

---

## Project Structure

```
RAG_PROJECT/
│
├── backend/
│   ├── main.py              # FastAPI app — endpoints, session wiring, middleware
│   ├── rag_core.py          # RAG pipeline: chunking, embeddings, ChromaDB,
│   │                        #   hybrid retrieval, cross-encoder reranking, LLM chains
│   ├── session_store.py     # SQLAlchemy SessionStore (SQLite / PostgreSQL)
│   ├── query_logger.py      # Append-only JSONL query observability logger
│   ├── rate_limiter.py      # Per-IP sliding-window rate limit middleware
│   ├── requirements.txt     # Runtime Python dependencies
│   ├── requirements-dev.txt # Dev/test dependencies (pytest, hypothesis, httpx)
│   ├── tests/
│   │   ├── conftest.py              # Shared fixtures
│   │   ├── test_chunking.py         # load_and_split_multiple_pdfs tests
│   │   ├── test_hybrid_retriever.py # HybridRetriever tests
│   │   ├── test_reranking.py        # rerank_documents tests
│   │   ├── test_citation.py         # ask() source citation tests
│   │   ├── test_vectorstore.py      # Vector store persistence tests
│   │   ├── test_session_store.py    # SessionStore unit + property tests
│   │   ├── test_query_logger.py     # QueryLogger tests
│   │   ├── test_rate_limiter.py     # Rate limiter tests
│   │   ├── test_ragas_baseline.py   # RAGAS regression test
│   │   └── ragas_baseline.json      # Checked-in baseline scores
│   ├── Dockerfile
│   ├── .env                 # GROQ_API_KEY etc. (not committed)
│   └── .python-version      # 3.11.9
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── index.css
│   │   ├── motion.js
│   │   └── components/
│   │       ├── Sidebar.jsx          # Upload + fallback embedding warning banner
│   │       ├── ChatTab.jsx          # Streaming chat + per-query fallback indicator
│   │       ├── SummaryTab.jsx
│   │       ├── StudyNotesTab.jsx
│   │       ├── EvaluationTab.jsx
│   │       ├── AIInsightsPanel.jsx
│   │       ├── DocumentHistory.jsx
│   │       ├── PDFViewer.jsx
│   │       ├── ExportButton.jsx
│   │       ├── SectionHeader.jsx
│   │       └── Spinner.jsx
│   ├── hooks/
│   │   ├── useDictation.js
│   │   └── useSpeech.js
│   ├── public/
│   ├── index.html
│   ├── Dockerfile
│   └── package.json
│
├── .env.example             # Template — copy to backend/.env
├── .gitignore
└── README.md
```

---

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | *(required)* | Groq API key — get one free at [console.groq.com](https://console.groq.com) |
| `CHROMA_PERSIST_DIR` | `/data/chroma_db` | Directory for ChromaDB persistent storage |
| `DATABASE_URL` | `sqlite:///./sessions.db` | SQLAlchemy URL — SQLite for local dev, PostgreSQL for prod |
| `ADMIN_API_KEY` | `changeme` | Secret key for the `GET /admin/query-logs` endpoint |
| `QUERY_LOG_PATH` | `/data/query_log.jsonl` | Path for the append-only query observability log |
| `USE_LOCAL_MODELS` | `true` | Set to `false` to force the lightweight hash-based embeddings on every upload |

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- Groq API key — free at [console.groq.com](https://console.groq.com)
- Clerk account — free at [clerk.com](https://clerk.com)

### 1. Clone

```bash
git clone https://github.com/mohamadammar21-0518/DocMind-AI.git
cd DocMind-AI
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt
```

Create `backend/.env`:
```
GROQ_API_KEY=gsk_your_key_here
DATABASE_URL=sqlite:///./sessions.db
CHROMA_PERSIST_DIR=./chroma_db
ADMIN_API_KEY=local_dev_secret
```

Start the backend:
```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key_here
```

Start the frontend:
```bash
npm run dev
```

Open **http://localhost:5173**

### 4. Running Tests

```bash
cd backend
pip install -r requirements-dev.txt

# All tests
pytest tests/ -v

# Only property-based tests
pytest tests/ -m property -v

# RAGAS regression (requires: pip install ragas datasets)
pytest tests/test_ragas_baseline.py -v
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | — | Health check |
| GET | `/ping` | — | Wake-up / cold start check |
| GET | `/models` | — | List available LLM models |
| POST | `/upload` | — | Upload and index PDFs (multipart/form-data) |
| POST | `/chat` | — | Non-streaming Q&A |
| POST | `/chat/stream` | — | Streaming Q&A via SSE |
| POST | `/summarize` | — | Map-Reduce document summary |
| POST | `/study-notes` | — | Structured study notes |
| POST | `/suggest-questions` | — | 5 AI-generated questions |
| POST | `/evaluate` | — | RAGAS evaluation |
| GET | `/session/{id}` | — | Session state (pdf_names, pages, chunks) |
| DELETE | `/session/{id}` | — | Clear session |
| GET | `/admin/query-logs` | `X-Admin-Api-Key` | Last 50 query log records |
| DELETE | `/admin/sessions/purge` | — | Purge sessions older than 30 days |

All POST endpoints (except `/upload`) accept JSON with a `session_id` field.

The `/upload` response includes:
- `fallback_embedding` — `true` when hash-based embeddings were used
- `reranker` — `"cross_encoder"` or `"llm_judge"` indicating the active strategy

---

## Deployment (Google Cloud Run)

### Backend

```bash
cd backend
gcloud run deploy docmind-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GROQ_API_KEY=your_key,DATABASE_URL=postgresql://...
```

For persistent storage, mount a Cloud Run volume at `/data` and set `CHROMA_PERSIST_DIR=/data/chroma_db`.

### Frontend

Set production env vars in `frontend/.env.production`:
```
VITE_API_URL=https://docmind-backend-2jgx6au47a-uc.a.run.app
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_key
```

Build and deploy:
```bash
cd frontend
npm run build

gcloud run deploy docmind-frontend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

---

## Known Limitations

- **QA chain not persisted** — the LangChain QA chain lives in memory only. After a container restart, users with active sessions need to re-upload their documents to rebuild the chain (session metadata is preserved in the DB).
- **Rate limiter is single-instance** — the in-memory sliding window resets on restart and is not shared across Cloud Run instances. For multi-instance deployments, replace with a Redis-backed limiter.
- **Memory on the free tier** — large PDFs (50+ pages) can push RAM limits. The embedding service falls back to a lightweight hash-based model automatically when `sentence-transformers` fails to load; a warning banner is shown in the UI.
- **RAGAS evaluation** — only works locally with `pip install ragas datasets`. The deployed backend returns an informative error if RAGAS is not installed.
- **Groq rate limits** — summarization and study notes batch API calls with 1.5s delays between batches to stay within the free-tier TPM limit.

---

## Roadmap

- Persistent vector store (ChromaDB PersistentClient on durable volume) ✅
- Persistent session and chat history (SQLAlchemy — SQLite / PostgreSQL) ✅
- Embedding fallback visibility (API flag + frontend warning banner) ✅
- Cross-encoder reranking with LLM escalation ✅
- Automated test suite (pytest + hypothesis property-based tests) ✅
- Query observability logging (JSONL + secured admin endpoint) ✅
- Per-IP rate limiting (sliding window middleware) ✅
- Architecture diagram and README documentation ✅

---

## Author

**Mohamad Ammar** — cloud computing portfolio project.

## License

MIT
