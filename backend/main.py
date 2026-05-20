"""
main.py — FastAPI backend for DocMind AI
"""
import os
import shutil
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from rag_core import (
    load_and_split_multiple_pdfs, build_vectorstore, build_qa_chain,
    ask, summarize_pdf, generate_suggested_questions,
    generate_study_notes, evaluate_rag, GROQ_MODELS,
)

app = FastAPI(title="DocMind AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory session store (single user) ────────────────────────────────────
session = {
    "qa_chain"     : None,
    "chunks"       : [],
    "pdf_names"    : [],
    "num_pages"    : 0,
    "num_chunks"   : 0,
    "chroma_client": None,
}

# ── Request models ────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    question    : str
    chat_history: List[dict] = []

class EvalRequest(BaseModel):
    questions: List[str]

class SuggestRequest(BaseModel):
    pass

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "DocMind AI API running"}

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
):
    if not files:
        raise HTTPException(400, "No files uploaded")

    # Use env var if no key provided by user
    key = groq_api_key or os.getenv("GROQ_API_KEY", "")
    if not key:
        raise HTTPException(400, "Groq API key required")

    model_name = GROQ_MODELS.get(model_label, "llama-3.1-8b-instant")
    tmp_files  = []

    try:
        for f in files:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            tmp.write(await f.read())
            tmp.close()
            tmp_files.append({"path": tmp.name, "name": f.filename})

        chunks, total_pages = load_and_split_multiple_pdfs(
            tmp_files, chunk_size, chunk_overlap)
        vectorstore = build_vectorstore(chunks)
        qa_chain    = build_qa_chain(vectorstore, chunks, groq_api_key, model_name)

        session["qa_chain"]  = qa_chain
        session["chunks"]    = chunks
        session["pdf_names"] = [f["name"] for f in tmp_files]
        session["num_pages"] = total_pages
        session["num_chunks"]= len(chunks)

        return {
            "success"  : True,
            "pdf_names": session["pdf_names"],
            "num_pages": total_pages,
            "num_chunks": len(chunks),
            "message"  : f"{len(files)} document(s) indexed successfully",
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"[ERROR] Upload failed: {error_detail}")
        raise HTTPException(500, f"{str(e)} | {error_detail}")
    finally:
        for f in tmp_files:
            try: os.unlink(f["path"])
            except: pass

@app.post("/chat")
def chat(req: ChatRequest):
    if not session["qa_chain"]:
        raise HTTPException(400, "No document loaded. Upload a PDF first.")
    try:
        result = ask(session["qa_chain"], req.question, req.chat_history)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/summarize")
def summarize():
    if not session["qa_chain"]:
        raise HTTPException(400, "No document loaded.")
    try:
        summary = summarize_pdf(session["qa_chain"], session["num_pages"])
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/study-notes")
def study_notes():
    if not session["qa_chain"]:
        raise HTTPException(400, "No document loaded.")
    try:
        notes = generate_study_notes(session["qa_chain"], session["num_pages"])
        return {"notes": notes}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/suggest-questions")
def suggest_questions():
    if not session["qa_chain"]:
        raise HTTPException(400, "No document loaded.")
    try:
        questions = generate_suggested_questions(session["qa_chain"])
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/evaluate")
def evaluate(req: EvalRequest):
    if not session["qa_chain"]:
        raise HTTPException(400, "No document loaded.")
    try:
        # Try to import ragas — not installed on free tier to save memory
        try:
            import ragas  # noqa
        except ImportError:
            return {
                "error": "RAGAS evaluation is not available on the free deployment tier (requires too much memory). Run locally with: pip install ragas datasets",
                "faithfulness": 0,
                "answer_relevancy": 0,
                "context_precision": 0,
                "per_question": [],
            }
        results = evaluate_rag(session["qa_chain"], req.questions)
        return results
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/session")
def get_session():
    return {
        "loaded"    : session["qa_chain"] is not None,
        "pdf_names" : session["pdf_names"],
        "num_pages" : session["num_pages"],
        "num_chunks": session["num_chunks"],
    }

@app.delete("/session")
def clear_session():
    session["qa_chain"]  = None
    session["chunks"]    = []
    session["pdf_names"] = []
    session["num_pages"] = 0
    session["num_chunks"]= 0
    return {"success": True, "message": "Session cleared"}
