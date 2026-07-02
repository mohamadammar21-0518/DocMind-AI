# DocMind AI

A cloud-native AI application that lets you chat with your PDF documents using natural language — powered by Groq Llama 3, LangChain, and ChromaDB, fully deployed on Google Cloud Run.

**Live App:** [docmind-frontend-817865882900.us-central1.run.app](https://docmind-frontend-817865882900.us-central1.run.app)  
**Backend API:** [docmind-backend-2jgx6au47a-uc.a.run.app](https://docmind-backend-2jgx6au47a-uc.a.run.app)

---

## How It Works

### The User Flow

1. User visits the app and signs in via **Clerk** authentication
2. User uploads one or more PDFs through the sidebar
3. The backend processes the PDF — extracts text, splits into chunks, builds a vector index
4. User types a question (or speaks it using the built-in mic)
5. The backend runs hybrid search, reranks results, calls Groq LLM, and streams the answer back word-by-word
6. The answer appears with page citations, a confidence score, and source snippets

### The RAG Pipeline (What Happens on Upload)

```
PDF file
    ↓
PyPDF extracts raw text page by page
    ↓
RecursiveCharacterTextSplitter splits into chunks
(default: 800 chars, 100 char overlap)
    ↓
sentence-transformers/all-MiniLM-L6-v2 generates 384-dim embeddings
(falls back to lightweight hash-based embeddings on memory-constrained deploys)
    ↓
ChromaDB stores vectors in-memory (ephemeral, per-session)
BM25Retriever indexes same chunks for keyword search
    ↓
Session stored in server memory, keyed by browser UUID
```

### The RAG Pipeline (What Happens on a Question)

```
User question
    ↓
BM25 keyword search (40%) + ChromaDB vector search (60%) → merged results
    ↓
LLM-as-judge reranking: Groq llama-3.1-8b-instant scores each chunk 0–10
    ↓
Top 4 chunks by score passed as context to Groq LLM
    ↓
Answer streamed back via Server-Sent Events (SSE)
    ↓
Frontend renders token-by-token + page citations + 1–5 star confidence score
```

### Session Management

Every browser generates a UUID on first visit, stored in `localStorage`. This UUID is sent with every request so the backend can map it to an isolated in-memory session (vector store + chat history). No two users share data. Sessions are lost when the Cloud Run container restarts (scale-to-zero), which is expected behavior.

---

## Features

- **Streaming Chat** — word-by-word responses via SSE, with page citations and confidence score
- **Smart Summarization** — Map-Reduce over every chunk for full-document coverage
- **Study Notes** — structured notes with key terms, examples, visual overview, and practice questions
- **RAGAS Evaluation** — faithfulness, answer relevancy, and context precision scoring (local only)
- **Suggested Questions** — AI-generated questions based on document content
- **Multi-PDF Support** — upload and query across multiple documents in one session
- **Voice Input** — browser Web Speech API for dictation in the chat input
- **Text-to-Speech** — AI answers can be read aloud, mic auto-mutes during playback
- **Export** — download results as Markdown, plain text, or PDF
- **Dark / Light Mode** — persisted per browser via `localStorage`
- **Auth** — Clerk sign-in, isolated session per user
- **Mobile Responsive** — sidebar collapses on small screens

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Framer Motion, react-pdf, Clerk |
| Styling | CSS custom properties (design system), dark/light themes |
| Backend | FastAPI, Uvicorn, Python 3.11 |
| LLM | Groq API — Llama 3.1 8B / Llama 3.3 70B / Gemma 2 9B |
| RAG framework | LangChain, LangChain-Groq, LangChain-Community |
| Vector DB | ChromaDB (ephemeral, in-memory per session) |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` (384-dim) |
| Keyword search | BM25 via rank-bm25 |
| Reranking | Groq LLM-as-judge (llama-3.1-8b-instant) |
| PDF parsing | PyPDF |
| Evaluation | RAGAS (local only) |
| Containerization | Docker |
| Deployment | Google Cloud Run (both frontend and backend) |
| Auth | Clerk |

---

## Project Structure

```
RAG_PROJECT/
│
├── backend/
│   ├── main.py              # FastAPI app — all API endpoints, session management
│   ├── rag_core.py          # Full RAG pipeline: chunking, embedding, retrieval,
│   │                        #   reranking, LLM chains, summarization, study notes,
│   │                        #   suggested questions, RAGAS evaluation
│   ├── requirements.txt     # Python dependencies (pinned versions)
│   ├── Dockerfile           # Builds the Cloud Run container (python:3.11-slim)
│   ├── .env                 # GROQ_API_KEY (not committed)
│   ├── .gcloudignore        # Excludes venv, chroma_db, .env from gcloud uploads
│   └── .python-version      # 3.11.9
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx                    # Entry — ClerkProvider wraps App
│   │   ├── App.jsx                     # Root: auth gate, topbar, tab routing, theme
│   │   ├── api.js                      # All Axios calls + session UUID management
│   │   ├── index.css                   # Full design system (CSS variables, themes)
│   │   ├── motion.js                   # Shared Framer Motion animation variants
│   │   └── components/
│   │       ├── LandingPage.jsx         # Auth landing page
│   │       ├── Sidebar.jsx             # PDF upload, model picker, chunk settings
│   │       ├── ChatTab.jsx             # Streaming chat with voice input/TTS
│   │       ├── SummaryTab.jsx          # Document summarization
│   │       ├── StudyNotesTab.jsx       # Study notes generation
│   │       ├── EvaluationTab.jsx       # RAGAS evaluation UI
│   │       ├── AIInsightsPanel.jsx     # AI insights panel
│   │       ├── DocumentHistory.jsx     # Recently uploaded docs (localStorage)
│   │       ├── PDFViewer.jsx           # In-app PDF viewer (react-pdf)
│   │       ├── ExportButton.jsx        # Export to MD / TXT / PDF
│   │       ├── SectionHeader.jsx       # Reusable section header
│   │       └── Spinner.jsx             # Loading spinner
│   ├── hooks/
│   │   ├── useDictation.js             # Web Speech API — mic input with pause/resume
│   │   └── useSpeech.js                # Web Speech Synthesis — TTS with mic muting
│   ├── public/
│   │   ├── logo.png
│   │   └── favicon.svg
│   ├── index.html                      # SEO meta, Open Graph, font imports
│   ├── Dockerfile                      # Nginx container serving the built dist/
│   ├── .env.local                      # Dev env vars (not committed)
│   ├── .env.production                 # Production env vars (not committed)
│   ├── .gcloudignore                   # Excludes node_modules, src/, .env from gcloud
│   ├── vite.config.js                  # Vite config with /api proxy for local dev
│   └── package.json
│
├── .gitignore
├── .env.example                        # Template — copy to backend/.env
└── README.md
```

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

> The Vite dev server proxies `/api/*` to `localhost:8000`, so CORS is not an issue locally.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/ping` | Wake-up / cold start check |
| GET | `/models` | List available LLM models |
| POST | `/upload` | Upload and index PDFs (multipart form) |
| POST | `/chat` | Non-streaming Q&A |
| POST | `/chat/stream` | Streaming Q&A via Server-Sent Events |
| POST | `/summarize` | Generate Map-Reduce document summary |
| POST | `/study-notes` | Generate structured study notes |
| POST | `/suggest-questions` | Get 5 AI-generated questions |
| POST | `/evaluate` | Run RAGAS evaluation on test questions |
| GET | `/session/{id}` | Get session state (loaded, pdf_names, pages, chunks) |
| DELETE | `/session/{id}` | Clear session and free memory |

All POST endpoints (except `/upload`) accept JSON with a `session_id` field.

---

## Deployment (Google Cloud Run)

Both frontend and backend are deployed as Docker containers on Google Cloud Run under GCP project `docmind-ai-501117`.

### Backend

```bash
cd backend
gcloud run deploy docmind-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GROQ_API_KEY=your_key_here
```

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

The frontend `Dockerfile` copies the built `dist/` into an Nginx container that handles SPA routing. Cloud Run injects `$PORT` (default 8080) automatically.

---

## Known Limitations

- **Session persistence** — sessions are in-memory and lost when Cloud Run scales to zero (after ~5 min of inactivity). Users need to re-upload their PDF after a cold start.
- **Memory** — large PDFs (50+ pages) push RAM usage on the free tier. The embedding system falls back to a lightweight hash-based model automatically if `sentence-transformers` fails to load.
- **RAGAS evaluation** — only works when running locally with `pip install ragas datasets`. The deployed backend returns an informative error if RAGAS is not available.
- **Groq rate limits** — summarization and study notes batch API calls with 1.5s delays between batches to stay within the free tier TPM limit.

---

## Author

**Mohamad Ammar** — cloud computing portfolio project.

## License

MIT
