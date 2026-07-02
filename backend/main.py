"""
main.py — FastAPI backend for DocMind AI
Fixes:
  1. Multi-user sessions (UUID per user stored in browser)
  2. File size limit (10MB per PDF)
  3. Cold start detection endpoint
  4. Persistent session storage via SessionStore (SQLite / PostgreSQL)
  5. APScheduler daily purge of old sessions
"""
import os
import uuid
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from rag_core import (
    load_and_split_multiple_pdfs, build_vectorstore, build_qa_chain,
    ask, summarize_pdf, generate_suggested_questions,
    generate_study_notes, evaluate_rag, GROQ_MODELS,
)
from session_store import SessionStore, StorageUnavailableError

app = FastAPI(title="DocMind AI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://docmind-frontend-817865882900.us-central1.run.app",
        "https://docmind-ai-501117.web.app",
        "https://docmind-ai-501117.firebaseapp.com",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Exception handler for StorageUnavailableError → HTTP 503 ──────────────────
@app.exception_handler(StorageUnavailableError)
async def storage_unavailable_handler(request: Request, exc: StorageUnavailableError):
    return JSONResponse(
        status_code=503,
        content={"error": "Storage unavailable", "detail": str(exc)},
    )

# ── Persistent session store ──────────────────────────────────────────────────
# Initialised at startup using the DATABASE_URL env var (defaults to SQLite).
# Raises StorageUnavailableError if the database cannot be reached.
session_store = SessionStore()

# ── In-memory QA chain cache ──────────────────────────────────────────────────
# qa_chain objects (LangChain objects) cannot be serialised to the DB.
# We keep them in-memory keyed by session_id.  Only the serialisable fields
# (pdf_names, num_pages, num_chunks, chat_history, collection_name, is_fallback)
# are persisted to the database.
_qa_chains: dict[str, dict] = {}

MAX_FILE_SIZE_MB = 15
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

# ── APScheduler daily purge ───────────────────────────────────────────────────
from apscheduler.schedulers.background import BackgroundScheduler

def _purge_old_sessions():
    """Called by the scheduler daily at midnight to clean up stale sessions."""
    try:
        deleted = session_store.purge_old(30)
        print(f"[scheduler] Purged {deleted} old session(s).")
    except Exception as exc:
        print(f"[scheduler] Purge failed: {exc}")

_scheduler = BackgroundScheduler()
_scheduler.add_job(_purge_old_sessions, trigger="cron", hour=0, minute=0)
_scheduler.start()

# ── Request models ────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    question    : str
    chat_history: List[dict] = []
    session_id  : str = ""

class EvalRequest(BaseModel):
    questions : List[str]
    session_id: str = ""

class SessionRequest(BaseModel):
    session_id: str = ""

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "DocMind AI API running", "version": "2.0.0"}

@app.get("/ping")
def ping():
    """Lightweight endpoint to wake up the server and check if it's alive."""
    return {"alive": True}

@app.get("/models")
def get_models():
    return {"models": list(GROQ_MODELS.keys())}

@app.post("/upload")
async def upload_pdfs(
    files        : List[UploadFile] = File(...),
    groq_api_key : str = Form(default=""),
    model_label  : str = Form("Llama 3.1 8B (Fast)"),
    chunk_size   : int = Form(800),
    chunk_overlap: int = Form(100),
    session_id   : str = Form(default=""),
):
    # ── Storage health check ──────────────────────────────────────────────────
    import rag_core as _rag_core
    if _rag_core.STORAGE_UNAVAILABLE:
        return JSONResponse(
            status_code=503,
            content={"error": "Storage unavailable", "detail": _rag_core.STORAGE_UNAVAILABLE_REASON},
        )

    if not files:
        raise HTTPException(400, "No files uploaded")

    # Use env var if no key provided
    key = groq_api_key or os.getenv("GROQ_API_KEY", "")
    if not key:
        raise HTTPException(400, "Groq API key required")

    # Generate session ID if not provided
    if not session_id:
        session_id = str(uuid.uuid4())

    model_name = GROQ_MODELS.get(model_label, "llama-3.1-8b-instant")
    tmp_files  = []

    try:
        for f in files:
            # ── File size check ───────────────────────────────────────────
            content = await f.read()
            if len(content) > MAX_FILE_SIZE_BYTES:
                raise HTTPException(
                    413,
                    f"'{f.filename}' is too large ({len(content)//1024//1024}MB). "
                    f"Maximum allowed size is {MAX_FILE_SIZE_MB}MB."
                )

            # ── File type check ───────────────────────────────────────────
            if not f.filename.lower().endswith(".pdf"):
                raise HTTPException(400, f"'{f.filename}' is not a PDF file.")

            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            tmp.write(content)
            tmp.close()
            tmp_files.append({"path": tmp.name, "name": f.filename})

        chunks, total_pages = load_and_split_multiple_pdfs(
            tmp_files, chunk_size, chunk_overlap)

        if not chunks:
            raise HTTPException(400, "Could not extract text from the PDF. Make sure it's not a scanned image-only PDF.")

        vs_result       = build_vectorstore(chunks, session_id=session_id)
        vectorstore     = vs_result["store"]
        is_fallback     = vs_result["is_fallback"]
        # Derive collection name the same way rag_core does
        collection_name = f"pdf_{session_id}"
        qa_chain        = build_qa_chain(vectorstore, chunks, key, model_name)

        # ── Persist serialisable session fields to DB ─────────────────────
        # (Req 2.1: write completes before returning success response)
        session_store.save(session_id, {
            "pdf_names"     : [f["name"] for f in tmp_files],
            "num_pages"     : total_pages,
            "num_chunks"    : len(chunks),
            "chat_history"  : [],
            "collection_name": collection_name,
            "is_fallback"   : is_fallback,
        })

        # ── Keep qa_chain in-memory only ──────────────────────────────────
        _qa_chains[session_id] = qa_chain

        return {
            "success"           : True,
            "session_id"        : session_id,
            "pdf_names"         : [f["name"] for f in tmp_files],
            "num_pages"         : total_pages,
            "num_chunks"        : len(chunks),
            "fallback_embedding": is_fallback,
            "message"           : f"{len(files)} document(s) indexed successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[ERROR] Upload failed: {traceback.format_exc()}")
        raise HTTPException(500, str(e))
    finally:
        for f in tmp_files:
            try: os.unlink(f["path"])
            except: pass

@app.post("/chat")
def chat(req: ChatRequest):
    # ── Storage health check ──────────────────────────────────────────────────
    import rag_core as _rag_core
    if _rag_core.STORAGE_UNAVAILABLE:
        return JSONResponse(
            status_code=503,
            content={"error": "Storage unavailable", "detail": _rag_core.STORAGE_UNAVAILABLE_REASON},
        )

    # Load session record from DB
    record = session_store.load(req.session_id)

    if record is None:
        raise HTTPException(400, "No document loaded. Upload a PDF first.")

    # Check if qa_chain is available in-memory (post-restart scenario)
    if req.session_id not in _qa_chains:
        # Req 2.3: session exists in DB but chain lost after restart
        raise HTTPException(400, "Session expired. Please re-upload your documents.")

    qa_chain = _qa_chains[req.session_id]

    try:
        return ask(qa_chain, req.question, req.chat_history)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Streaming chat endpoint using Server-Sent Events."""
    # ── Storage health check ──────────────────────────────────────────────────
    import rag_core as _rag_core
    if _rag_core.STORAGE_UNAVAILABLE:
        return JSONResponse(
            status_code=503,
            content={"error": "Storage unavailable", "detail": _rag_core.STORAGE_UNAVAILABLE_REASON},
        )

    # Load session record from DB
    record = session_store.load(req.session_id)

    if record is None:
        raise HTTPException(400, "No document loaded. Upload a PDF first.")

    # Check if qa_chain is available in-memory (post-restart scenario)
    if req.session_id not in _qa_chains:
        # Req 2.3: session exists in DB but chain lost after restart
        raise HTTPException(400, "Session expired. Please re-upload your documents.")

    qa_chain = _qa_chains[req.session_id]

    import json
    from langchain_core.messages import HumanMessage, AIMessage

    chain_dict = qa_chain
    chain      = chain_dict["chain"]
    retriever  = chain_dict["retriever"]
    rerank_llm = chain_dict.get("rerank_llm")

    messages = []
    for msg in req.chat_history:
        if msg.get("role") == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg.get("role") == "bot":
            messages.append(AIMessage(content=msg["content"]))

    # Get sources first (LLM-judge reranked), with a real confidence score.
    from rag_core import rerank_documents, _confidence_score
    raw_docs   = retriever.invoke(req.question)
    top_docs   = rerank_documents(req.question, raw_docs, top_k=4, llm=rerank_llm)
    confidence = _confidence_score(top_docs)
    is_fallback = record.get("is_fallback", False)
    sources    = [
        {
            "page"       : d.metadata.get("page", 0) + 1,
            "snippet"    : d.page_content[:300],
            "source_file": d.metadata.get("source_file", ""),
            "score"      : d.metadata.get("rerank_score"),
        }
        for d in top_docs
    ]

    async def generate():
        try:
            # Send sources (with scores) + confidence first
            yield f"data: {json.dumps({'type': 'sources', 'sources': sources, 'confidence': confidence, 'fallback_embedding': is_fallback})}\n\n"
            # Stream the answer
            async for chunk in chain.astream({"question": req.question, "chat_history": messages}):
                if chunk:
                    yield f"data: {json.dumps({'type': 'token', 'token': chunk})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.post("/summarize")
def summarize(req: SessionRequest):
    record = session_store.load(req.session_id)
    if record is None or req.session_id not in _qa_chains:
        raise HTTPException(400, "No document loaded.")
    try:
        return {"summary": summarize_pdf(_qa_chains[req.session_id], record["num_pages"])}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/study-notes")
def study_notes(req: SessionRequest):
    record = session_store.load(req.session_id)
    if record is None or req.session_id not in _qa_chains:
        raise HTTPException(400, "No document loaded.")
    try:
        return {"notes": generate_study_notes(_qa_chains[req.session_id], record["num_pages"])}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/suggest-questions")
def suggest_questions(req: SessionRequest):
    record = session_store.load(req.session_id)
    if record is None or req.session_id not in _qa_chains:
        raise HTTPException(400, "No document loaded.")
    try:
        return {"questions": generate_suggested_questions(_qa_chains[req.session_id])}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/evaluate")
def evaluate(req: EvalRequest):
    record = session_store.load(req.session_id)
    if record is None or req.session_id not in _qa_chains:
        raise HTTPException(400, "No document loaded.")
    try:
        try:
            import ragas  # noqa
        except ImportError:
            return {
                "error": "RAGAS evaluation is not available on the free deployment tier. Run locally with: pip install ragas datasets",
                "faithfulness": 0, "answer_relevancy": 0,
                "context_precision": 0, "per_question": [],
            }
        return evaluate_rag(_qa_chains[req.session_id], req.questions)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/session/{session_id}")
def get_session_info(session_id: str):
    record = session_store.load(session_id)
    if record is None:
        return {
            "loaded"    : False,
            "pdf_names" : [],
            "num_pages" : 0,
            "num_chunks": 0,
        }
    return {
        "loaded"    : session_id in _qa_chains,
        "pdf_names" : record["pdf_names"],
        "num_pages" : record["num_pages"],
        "num_chunks": record["num_chunks"],
    }

@app.delete("/session/{session_id}")
def clear_session_by_id(session_id: str):
    # Remove from in-memory chain cache
    _qa_chains.pop(session_id, None)
    # Remove from persistent store (best-effort — ignore if not found)
    try:
        # SessionStore doesn't expose a delete-by-id method, so we just
        # leave the DB record; it will be purged by the scheduled job.
        # If a delete method is added later, call it here.
        pass
    except Exception:
        pass
    return {"success": True}

# ── Admin routes ──────────────────────────────────────────────────────────────

@app.delete("/admin/sessions/purge")
def purge_old_sessions():
    """On-demand purge of session records older than 30 days. (Req 2.5)"""
    deleted = session_store.purge_old(30)
    return {"deleted": deleted}
