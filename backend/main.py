"""
main.py — FastAPI backend for DocMind AI
Fixes:
  1. Multi-user sessions (UUID per user stored in browser)
  2. File size limit (10MB per PDF)
  3. Cold start detection endpoint
"""
import os
import uuid
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from rag_core import (
    load_and_split_multiple_pdfs, build_vectorstore, build_qa_chain,
    ask, summarize_pdf, generate_suggested_questions,
    generate_study_notes, evaluate_rag, GROQ_MODELS,
)

app = FastAPI(title="DocMind AI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Multi-user session store ──────────────────────────────────────────────────
# Each user gets a UUID session_id stored in their browser localStorage
# sessions[session_id] = { qa_chain, pdf_names, num_pages, num_chunks }
sessions: dict = {}

MAX_FILE_SIZE_MB = 15
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

def get_session(session_id: str) -> dict:
    if session_id not in sessions:
        sessions[session_id] = {
            "qa_chain" : None,
            "pdf_names": [],
            "num_pages": 0,
            "num_chunks": 0,
        }
    return sessions[session_id]

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
    chunk_size   : int = Form(1000),
    chunk_overlap: int = Form(200),
    session_id   : str = Form(default=""),
):
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

        vectorstore = build_vectorstore(chunks)
        qa_chain    = build_qa_chain(vectorstore, chunks, key, model_name)

        # Store in user's session
        sess = get_session(session_id)
        sess["qa_chain"]  = qa_chain
        sess["pdf_names"] = [f["name"] for f in tmp_files]
        sess["num_pages"] = total_pages
        sess["num_chunks"]= len(chunks)

        return {
            "success"   : True,
            "session_id": session_id,
            "pdf_names" : sess["pdf_names"],
            "num_pages" : total_pages,
            "num_chunks": len(chunks),
            "message"   : f"{len(files)} document(s) indexed successfully",
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
    sess = get_session(req.session_id)
    if not sess["qa_chain"]:
        raise HTTPException(400, "No document loaded. Upload a PDF first.")
    try:
        return ask(sess["qa_chain"], req.question, req.chat_history)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/summarize")
def summarize(req: SessionRequest):
    sess = get_session(req.session_id)
    if not sess["qa_chain"]:
        raise HTTPException(400, "No document loaded.")
    try:
        return {"summary": summarize_pdf(sess["qa_chain"], sess["num_pages"])}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/study-notes")
def study_notes(req: SessionRequest):
    sess = get_session(req.session_id)
    if not sess["qa_chain"]:
        raise HTTPException(400, "No document loaded.")
    try:
        return {"notes": generate_study_notes(sess["qa_chain"], sess["num_pages"])}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/suggest-questions")
def suggest_questions(req: SessionRequest):
    sess = get_session(req.session_id)
    if not sess["qa_chain"]:
        raise HTTPException(400, "No document loaded.")
    try:
        return {"questions": generate_suggested_questions(sess["qa_chain"])}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/evaluate")
def evaluate(req: EvalRequest):
    sess = get_session(req.session_id)
    if not sess["qa_chain"]:
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
        return evaluate_rag(sess["qa_chain"], req.questions)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/session/{session_id}")
def get_session_info(session_id: str):
    sess = get_session(session_id)
    return {
        "loaded"    : sess["qa_chain"] is not None,
        "pdf_names" : sess["pdf_names"],
        "num_pages" : sess["num_pages"],
        "num_chunks": sess["num_chunks"],
    }

@app.delete("/session/{session_id}")
def clear_session_by_id(session_id: str):
    if session_id in sessions:
        del sessions[session_id]
    return {"success": True}
