# 🧠 DocMind AI

> **Chat with your PDF documents using AI** — powered by Groq Llama 3, LangChain, and ChromaDB.

![DocMind AI](frontend/public/logo.png)

**Live Demo:** [doc-mind-ai-ecru.vercel.app](https://doc-mind-ai-ecru.vercel.app)  
**Backend API:** [docmind-ai-b4mb.onrender.com](https://docmind-ai-b4mb.onrender.com)

---

## 📌 What is DocMind AI?

DocMind AI is a full-stack **Retrieval-Augmented Generation (RAG)** application that lets you upload any PDF and instantly:

- 💬 **Chat** with it in natural language
- 📝 **Summarize** the entire document (Map-Reduce over every page)
- 🎓 **Generate study notes** with examples, key terms, and practice questions
- 📊 **Evaluate** answer quality using RAGAS metrics
- 💡 **Get suggested questions** based on document content

---

## 🏗️ Architecture

```
User Browser
    │
    ├── React Frontend (Vercel)
    │       ├── Chat UI with streaming responses
    │       ├── PDF Viewer (react-pdf)
    │       ├── Dark / Light mode
    │       └── Mobile responsive
    │
    └── FastAPI Backend (Render)
            │
            ├── PDF Ingestion (PyPDF)
            ├── Text Chunking (LangChain)
            ├── Hybrid Search (BM25 + Vector)
            ├── ChromaDB (in-memory vector store)
            ├── Groq LLM (Llama 3.1 / 3.3 / Gemma 2)
            └── RAGAS Evaluation
```

---

## ✨ Features

| Feature | Description |
|---|---|
| 💬 **Conversational Q&A** | Ask questions, get answers with page citations |
| 📝 **Smart Summarization** | Map-Reduce reads every page for complete coverage |
| 🎓 **Study Notes** | Structured notes with examples, key terms, visual overview |
| 🔍 **Hybrid Search** | BM25 keyword + vector semantic search combined |
| 📊 **RAGAS Evaluation** | Faithfulness, relevancy, and precision scoring |
| 💡 **Suggested Questions** | AI-generated questions based on document content |
| 📄 **Multi-PDF Support** | Upload multiple PDFs, query across all of them |
| 🌊 **Streaming Responses** | Word-by-word streaming like ChatGPT |
| 📱 **Mobile Responsive** | Works on phones and tablets |
| 🌙 **Dark / Light Mode** | Toggle between themes |
| 💾 **Chat Persistence** | Conversations survive page refresh |
| 📤 **Export** | Download as Markdown, Plain Text, or PDF |
| 🔐 **Multi-user Sessions** | Each browser gets an isolated session UUID |
| ⭐ **Confidence Score** | 1-5 star rating on each answer |

---

## 🚀 Quick Start (Local)

### Prerequisites
- Python 3.11+
- Node.js 18+
- Groq API key (free at [console.groq.com](https://console.groq.com))

### 1. Clone the repo
```bash
git clone https://github.com/mohamadammar21-0518/DocMind-AI.git
cd DocMind-AI
```

### 2. Backend setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt
```

Create a `.env` file in `backend/`:
```
GROQ_API_KEY=gsk_your_key_here
```

Start the backend:
```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend setup
```bash
cd frontend
npm install
```

Create a `.env.local` file in `frontend/`:
```
VITE_API_URL=http://localhost:8000
```

Start the frontend:
```bash
npm run dev
```

Open **http://localhost:5173**

---

## 🌐 Deployment

### Backend → Render
| Setting | Value |
|---|---|
| Runtime | Python 3.11 |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Environment Variable | `GROQ_API_KEY=your_key` |

### Frontend → Vercel / Render Static Site
| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment Variable | `VITE_API_URL=https://your-backend.onrender.com` |

---

## 📁 Project Structure

```
DocMind-AI/
├── backend/
│   ├── main.py           # FastAPI app — all API endpoints
│   ├── rag_core.py       # RAG pipeline (chunking, retrieval, LLM)
│   ├── requirements.txt
│   └── .python-version   # Python 3.11.9
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Main app with routing & theme
│   │   ├── api.js                # API calls with session management
│   │   ├── index.css             # Global styles + dark/light themes
│   │   └── components/
│   │       ├── LandingPage.jsx   # Marketing landing page
│   │       ├── Sidebar.jsx       # Upload, settings, history
│   │       ├── ChatTab.jsx       # Streaming chat interface
│   │       ├── SummaryTab.jsx    # Document summarization
│   │       ├── StudyNotesTab.jsx # Study notes generation
│   │       ├── EvaluationTab.jsx # RAGAS evaluation
│   │       ├── PDFViewer.jsx     # In-app PDF viewer
│   │       ├── DocumentHistory.jsx # Recent documents
│   │       └── ExportButton.jsx  # Export to MD/TXT/PDF
│   ├── public/
│   │   └── logo.png
│   └── package.json
│
└── README.md
```

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, react-pdf, framer-motion |
| **Backend** | FastAPI, Uvicorn |
| **LLM** | Groq (Llama 3.1 8B / 3.3 70B / Gemma 2 9B) |
| **RAG** | LangChain, LangChain-Groq, LangChain-Classic |
| **Vector DB** | ChromaDB (in-memory) |
| **Search** | BM25 (rank-bm25) + Vector similarity |
| **PDF Parsing** | PyPDF |
| **Evaluation** | RAGAS (local only) |
| **Deployment** | Vercel (frontend) + Render (backend) |

---

## 📊 RAG Pipeline

```
PDF Upload
    ↓
PyPDF → Text Extraction
    ↓
RecursiveCharacterTextSplitter → Chunks (800 chars, 100 overlap)
    ↓
ChromaDB → Vector Store (hash-based embeddings)
    ↓
User Question
    ↓
Hybrid Retrieval: BM25 (40%) + Vector (60%)
    ↓
Deduplication & Reranking → Top 4 chunks
    ↓
Groq Llama 3 → Answer + Sources
    ↓
Confidence Score (1-5 stars)
```

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/ping` | Wake up check |
| GET | `/models` | Available LLM models |
| POST | `/upload` | Upload and index PDFs |
| POST | `/chat` | Ask a question |
| POST | `/chat/stream` | Streaming chat (SSE) |
| POST | `/summarize` | Generate summary |
| POST | `/study-notes` | Generate study notes |
| POST | `/suggest-questions` | Get suggested questions |
| POST | `/evaluate` | RAGAS evaluation |
| GET | `/session/{id}` | Get session info |
| DELETE | `/session/{id}` | Clear session |

---

## 💡 Example Questions to Try

- *"What is the main topic of this document?"*
- *"Summarize chapter 2"*
- *"What are the key findings?"*
- *"List all recommendations mentioned"*
- *"What does the author conclude?"*
- *"Explain [concept] in simple terms"*

---

## ⚠️ Limitations (Free Tier)

- **Cold start:** Backend sleeps after 15 min inactivity — first request takes ~30s to wake up
- **Memory:** 512MB RAM — large PDFs (50+ pages) may be slow
- **Sessions:** Lost when server restarts (no persistent database)
- **RAGAS:** Evaluation only available when running locally

---

## 🛣️ Roadmap

- [ ] Supabase integration for persistent sessions
- [ ] User authentication (Google/GitHub login)
- [ ] Document history across sessions
- [ ] Reranking with cross-encoder (local deployment)
- [ ] FastAPI + React Native mobile app

---

## 👨‍💻 Author

**Mohamad Ammar**  
Built as a portfolio project demonstrating full-stack AI/RAG engineering.

---

## 📄 License

MIT License — free to use, modify, and distribute.
