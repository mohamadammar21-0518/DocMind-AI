# 📄 PDF Q&A Chatbot (RAG)

A Retrieval-Augmented Generation (RAG) chatbot that lets you upload any PDF and ask questions about it. Built with LangChain, ChromaDB, OpenAI, and Streamlit.

---

## 🏗️ Architecture

```
PDF Upload
    ↓
PyPDFLoader  →  Text Chunks (RecursiveCharacterTextSplitter)
    ↓
OpenAI Embeddings  →  ChromaDB (Vector Store)
    ↓
User Question  →  Similarity Search  →  Top-4 Relevant Chunks
    ↓
GPT-3.5-Turbo  →  Answer + Source Pages
```

---

## 🚀 Quick Start

### 1. Clone / open the project
```bash
cd RAG_PROJECT
```

### 2. Create a virtual environment
```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Add your OpenAI API key
Either create a `.env` file:
```
OPENAI_API_KEY=sk-your-key-here
```
Or enter it directly in the app's sidebar.

### 5. Run the app
```bash
streamlit run app.py
```

Open your browser at `http://localhost:8501`

---

## 📁 Project Structure

```
RAG_PROJECT/
├── app.py            # Streamlit UI
├── rag_core.py       # RAG pipeline (load, embed, retrieve, answer)
├── requirements.txt  # Python dependencies
├── .env.example      # API key template
├── chroma_db/        # Auto-created: persisted vector store
└── README.md
```

---

## ✨ Features

- Upload any PDF (textbooks, papers, reports, manuals)
- Automatic text chunking with overlap for better context
- Persistent ChromaDB vector store (survives app restarts)
- Conversational memory — ask follow-up questions
- Source citations with page numbers and text snippets
- Clean chat UI with user/bot bubbles

---

## 🔧 Configuration

Edit constants in `rag_core.py`:

| Variable | Default | Description |
|---|---|---|
| `CHUNK_SIZE` | 1000 | Characters per chunk |
| `CHUNK_OVERLAP` | 200 | Overlap between chunks |
| `EMBEDDING_MODEL` | text-embedding-3-small | OpenAI embedding model |
| `CHAT_MODEL` | gpt-3.5-turbo | OpenAI chat model |
| `k` (retriever) | 4 | Number of chunks retrieved per query |

---

## 💡 Example Questions to Try

- "What is the main topic of this document?"
- "Summarize chapter 2"
- "What are the key findings?"
- "What does the author say about X?"
- "List all the recommendations mentioned"

---

## 🛠️ Tech Stack

| Tool | Purpose |
|---|---|
| LangChain | RAG orchestration |
| ChromaDB | Vector database |
| OpenAI | Embeddings + LLM |
| PyPDF | PDF parsing |
| Streamlit | Web UI |
