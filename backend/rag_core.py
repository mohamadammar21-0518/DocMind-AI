"""
rag_core.py — Advanced RAG Pipeline
Features:
  - Multi-PDF ingestion & chunking
  - Real semantic embeddings (sentence-transformers) with lightweight fallback
  - ChromaDB vector store
  - BM25 keyword search + Vector search (Hybrid)
  - Groq LLM-as-judge reranking (with dedup-only fallback)
  - Groq LLM (Llama 3.1)
  - Map-Reduce summarization
  - Study notes generation
  - Suggested questions
  - RAGAS evaluation
"""

import os
import re
import json
import shutil
import time
import hashlib
import math
from dotenv import load_dotenv

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.retrievers import BM25Retriever
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.documents import Document

load_dotenv()

# ── Constants ─────────────────────────────────────────────────────────────────
CHROMA_DIR      = os.getenv("CHROMA_PERSIST_DIR", "/data/chroma_db")

# ── Storage health ────────────────────────────────────────────────────────────
# Set to True at import time if PersistentClient cannot initialise.
# All /upload and /chat handlers must check this flag before proceeding.
STORAGE_UNAVAILABLE: bool = False
STORAGE_UNAVAILABLE_REASON: str = ""


def check_storage_health() -> None:
    """
    Verify that ChromaDB's PersistentClient can open/create the data directory.

    Called once at module import. On failure sets STORAGE_UNAVAILABLE = True
    and logs the storage path plus the error reason so operators can diagnose
    mount / permission problems without inspecting a stack trace.
    """
    global STORAGE_UNAVAILABLE, STORAGE_UNAVAILABLE_REASON
    import chromadb as _chromadb
    try:
        _chromadb.PersistentClient(path=CHROMA_DIR)
        print(f"[RAG] Storage health OK — chroma path: {CHROMA_DIR}")
    except Exception as exc:
        reason = f"{type(exc).__name__}: {exc}"
        STORAGE_UNAVAILABLE = True
        STORAGE_UNAVAILABLE_REASON = reason
        print(f"[RAG] Storage UNAVAILABLE — path: {CHROMA_DIR} — reason: {reason}")


# Run the check immediately when the module is imported.
check_storage_health()

# Real semantic embedding model (384-dim). Used by both the vector store and
# RAGAS evaluation. Defining it here fixes a previously-undefined NameError in
# evaluate_rag().
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Reranking model used as the LLM-as-judge for scoring chunk relevance.
RERANK_MODEL    = "llama-3.1-8b-instant"


# ── 0. Embeddings ─────────────────────────────────────────────────────────────
# LightweightEmbedding is the zero-dependency fallback (no torch / onnxruntime).
# It maps text to a 64-dim vector via hashed character-trigram counts. Not truly
# semantic, but keeps the app working on the 512MB Render free tier where the
# real model would OOM. Kept at module scope so it can be reused as a fallback.
class LightweightEmbedding:
    """Hash-based 64-dim embedding — the dependency-free fallback path."""
    def __call__(self, input):
        results = []
        for text in input:
            vec = [0.0] * 64
            text_lower = text.lower()
            for i in range(len(text_lower) - 2):
                ngram = text_lower[i:i+3]
                h = int(hashlib.md5(ngram.encode()).hexdigest(), 16)
                vec[h % 64] += 1.0
            norm = math.sqrt(sum(x*x for x in vec)) or 1.0
            vec = [x / norm for x in vec]
            results.append(vec)
        return results


# Cache so the (slow) model load happens once per process.
_embeddings_cache = {"real": None, "fallback": None}


def get_embeddings() -> tuple:
    """
    Return a ``(embedding_function, is_fallback: bool)`` tuple.

    ``is_fallback`` is ``True`` when ``LightweightEmbedding`` is active and
    ``False`` when the real ``all-MiniLM-L6-v2`` model is used.

    Resolution order:
      1. If USE_LOCAL_MODELS == "false" (env), go straight to the fallback.
         Useful to force the lightweight path on memory-constrained deploys.
      2. Try to lazily import sentence-transformers via langchain_huggingface.
         On success, return ``(HuggingFaceEmbeddings, False)`` (cached).
      3. On any ImportError / load failure, warn and fall back to
         ``(LightweightEmbedding, True)`` (cached). The app keeps working, just
         less semantically accurate — never a hard crash (Req 3.6).

    This mirrors the existing RAGAS pattern: real when available, graceful
    degradation otherwise — never a hard crash.
    """
    use_local = os.getenv("USE_LOCAL_MODELS", "true").lower() == "true"

    if not use_local:
        if _embeddings_cache["fallback"] is None:
            print("[RAG] USE_LOCAL_MODELS=false → using LightweightEmbedding")
            _embeddings_cache["fallback"] = LightweightEmbedding()
        return (_embeddings_cache["fallback"], True)

    if _embeddings_cache["real"] is not None:
        return (_embeddings_cache["real"], False)

    try:
        from langchain_huggingface import HuggingFaceEmbeddings
        print(f"[RAG] Loading real embeddings: {EMBEDDING_MODEL} ...")
        _embeddings_cache["real"] = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
        print("[RAG] Real embeddings ready (sentence-transformers)")
        return (_embeddings_cache["real"], False)
    except Exception as e:
        print(f"[RAG] Real embeddings unavailable ({type(e).__name__}: {e}). "
              f"Falling back to LightweightEmbedding.")
        if _embeddings_cache["fallback"] is None:
            _embeddings_cache["fallback"] = LightweightEmbedding()
        return (_embeddings_cache["fallback"], True)

GROQ_MODELS = {
    "Llama 3.1 8B (Fast)"         : "llama-3.1-8b-instant",
    "Llama 3.3 70B (Best Quality)": "llama-3.3-70b-versatile",
    "Gemma 2 9B"                  : "gemma2-9b-it",
}


# ── Cross-Encoder Reranker ────────────────────────────────────────────────────
class CrossEncoderReranker:
    """
    Local neural reranker using cross-encoder/ms-marco-MiniLM-L-6-v2.

    Scores query–document pairs without any external API call.  On load
    failure the instance marks itself unavailable (`self._available = False`)
    and `score()` returns documents unchanged so the pipeline degrades
    gracefully (Req 4.5).
    """
    MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    def __init__(self):
        self._available = False
        self._model = None
        try:
            from sentence_transformers import CrossEncoder
            self._model = CrossEncoder(self.MODEL)
            self._available = True
            print(f"[RAG] CrossEncoderReranker loaded: {self.MODEL}")
        except Exception as exc:
            print(
                f"[RAG] WARNING: CrossEncoderReranker failed to load "
                f"({type(exc).__name__}: {exc}). "
                f"Will fall back to LLM reranker."
            )

    def score(self, query: str, docs: list) -> list:
        """
        Score query–chunk pairs and return docs sorted by descending score.

        Each returned document has ``metadata["rerank_score"]`` set to a
        float in the 0–10 range (min-max scaled across the batch).

        If the model is unavailable or *docs* is empty, docs are returned
        unchanged.
        """
        if not self._available or not docs:
            return docs

        pairs = [(query, doc.page_content) for doc in docs]
        raw_scores = self._model.predict(pairs)  # numpy array of raw logits

        # Min-max normalise to 0–10 across the batch.
        min_s = float(raw_scores.min())
        max_s = float(raw_scores.max())
        scores_0_10 = (raw_scores - min_s) / (max_s - min_s + 1e-8) * 10

        for i, doc in enumerate(docs):
            doc.metadata["rerank_score"] = float(scores_0_10[i])

        return sorted(docs, key=lambda d: d.metadata["rerank_score"], reverse=True)


# Module-level singleton — lazily initialised on first call to rerank_documents.
# Using a sentinel so we only attempt the (potentially slow) model load once.
_cross_encoder_reranker: "CrossEncoderReranker | None" = None
_cross_encoder_loaded: bool = False


def _get_cross_encoder() -> "CrossEncoderReranker | None":
    """
    Return the module-level CrossEncoderReranker, loading it on first call.

    Returns None if the model failed to load (so callers skip to the LLM path).
    """
    global _cross_encoder_reranker, _cross_encoder_loaded
    if not _cross_encoder_loaded:
        _cross_encoder_loaded = True
        try:
            _cross_encoder_reranker = CrossEncoderReranker()
        except Exception as exc:
            print(f"[RAG] CrossEncoder singleton init failed: {exc}")
            _cross_encoder_reranker = None
    return _cross_encoder_reranker


# ── 1. PDF Loading ─────────────────────────────────────────────────────────────
def load_and_split_multiple_pdfs(pdf_files, chunk_size=1000, chunk_overlap=200):
    """
    pdf_files: list of {"path": str, "name": str}
    Returns (chunks, total_pages)
    """
    all_chunks = []
    total_pages = 0
    for pdf in pdf_files:
        loader = PyPDFLoader(pdf["path"])
        pages  = loader.load()
        for page in pages:
            page.metadata["source_file"] = pdf["name"]
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", " ", ""],
        )
        chunks = splitter.split_documents(pages)
        all_chunks.extend(chunks)
        total_pages += len(pages)
        print(f"[RAG] '{pdf['name']}' -> {len(pages)} pages -> {len(chunks)} chunks")
    return all_chunks, total_pages


# ── 2. Vector Store ────────────────────────────────────────────────────────────
def build_vectorstore(chunks, session_id: str = "default", collection_name: str = None):
    """
    Build a persistent ChromaDB vector store over the given chunks.

    Uses real semantic embeddings (all-MiniLM-L6-v2) when available, and
    transparently falls back to the hash-based LightweightEmbedding when the
    real model can't be loaded (e.g. on the 512MB free tier). Either way the
    returned object exposes the same .similarity_search() / .get() interface.

    Parameters
    ----------
    chunks        : list[Document]  — text chunks to index
    session_id    : str             — per-user namespace; collection is f"pdf_{session_id}"
    collection_name: str | None     — override the derived collection name (legacy callers)

    Returns
    -------
    dict with keys:
        "store"       : SimpleVectorStore instance
        "is_fallback" : bool — True when LightweightEmbedding was used
    """
    import chromadb as _chromadb

    ef, is_fallback = get_embeddings()

    # Derive collection name from session_id unless caller overrides it.
    if collection_name is None:
        collection_name = f"pdf_{session_id}"

    chroma_client = _chromadb.PersistentClient(path=CHROMA_DIR)

    # ChromaDB expects an embedding_function that is __call__(input) -> list[list[float]].
    # - HuggingFaceEmbeddings is NOT callable; it exposes .embed_documents(list[str]).
    # - LightweightEmbedding IS callable with the same signature Chroma wants.
    # This adapter normalises both into the ChromaDB interface.
    class ChromaEmbeddingAdapter:
        def __init__(self, fn):
            self.fn = fn
        def __call__(self, input):
            # input is a list[str] of texts to embed.
            if hasattr(self.fn, "embed_documents"):
                return self.fn.embed_documents(input)
            return self.fn(input)
        # ChromaDB also checks for a name attribute in some versions.
        def name(self):
            return "docmind_embedding"

    # Always delete existing collection to avoid dimension mismatch when switching
    # between real (384-dim) and fallback (64-dim) embeddings across deploys.
    try:
        chroma_client.delete_collection(name=collection_name)
    except Exception:
        pass  # collection didn't exist yet

    collection = chroma_client.create_collection(
        name               = collection_name,
        embedding_function = ChromaEmbeddingAdapter(ef),
        metadata           = {"hnsw:space": "cosine"},
    )

    # Add documents in batches
    texts     = [c.page_content for c in chunks]
    metadatas = [c.metadata     for c in chunks]
    ids       = [str(i)         for i in range(len(chunks))]

    batch = 100
    for i in range(0, len(texts), batch):
        collection.add(
            documents = texts[i:i+batch],
            metadatas = metadatas[i:i+batch],
            ids       = ids[i:i+batch],
        )

    mode = "lightweight (hash)" if is_fallback else "semantic (MiniLM)"
    print(f"[RAG] Vector store built with {len(chunks)} chunks — embeddings: {mode}")

    class SimpleVectorStore:
        def __init__(self, col):
            self.col = col
        def similarity_search(self, query, k=6):
            results = self.col.query(query_texts=[query], n_results=min(k, len(texts)))
            docs = []
            for i, doc in enumerate(results["documents"][0]):
                meta = results["metadatas"][0][i] if results["metadatas"] else {}
                docs.append(Document(page_content=doc, metadata=meta))
            return docs
        def get(self):
            all_docs = self.col.get()
            return {"documents": all_docs["documents"], "metadatas": all_docs["metadatas"]}

    return {"store": SimpleVectorStore(collection), "is_fallback": is_fallback}


# ── 3. Hybrid Retriever (BM25 + Vector + Reranker) ────────────────────────────
def build_hybrid_retriever(vectorstore, chunks, k=6):
    bm25_retriever = BM25Retriever.from_documents(chunks)
    bm25_retriever.k = k

    class VectorRetriever:
        def invoke(self, query):
            return vectorstore.similarity_search(query, k=k)

    class HybridRetriever:
        def __init__(self):
            self.vectorstore = vectorstore
        def invoke(self, query):
            bm25_docs   = bm25_retriever.invoke(query)
            vector_docs = vectorstore.similarity_search(query, k=k)
            # Merge and deduplicate
            seen = set()
            merged = []
            for doc in bm25_docs + vector_docs:
                key = doc.page_content[:80]
                if key not in seen:
                    seen.add(key)
                    merged.append(doc)
            return merged[:k*2]

    print("[RAG] Hybrid retriever ready")
    return HybridRetriever()


def rerank_documents(query, docs, top_k=4, llm=None):
    """
    Two-stage reranking pipeline:

    Stage 1 — CrossEncoder (local, no API cost):
        Scores all deduplicated candidates using the cross-encoder neural model.
        Produces a coarse ranking with rerank_score set on each doc.
        Skipped gracefully if the model isn't available.

    Stage 2 — LLM-as-judge (Groq, best quality):
        Re-scores the top candidates from Stage 1 using an LLM prompt.
        Only runs when `llm` is provided. Overwrites rerank_score with the
        LLM's judgement. Falls back to the Stage 1 order on any error.

    Graceful fallback: if both stages fail/are unavailable, returns
    deduplicated docs in original retrieval order — never crashes.
    """
    if not docs:
        return docs

    # ── 1. Deduplicate (always) ────────────────────────────────────────────────
    seen = set()
    unique = []
    for doc in docs:
        key = doc.page_content[:100]
        if key not in seen:
            seen.add(key)
            unique.append(doc)

    # ── Stage 1: CrossEncoder local reranking ──────────────────────────────────
    cross_encoder = _get_cross_encoder()
    if cross_encoder is not None and cross_encoder._available and len(unique) > 1:
        try:
            unique = cross_encoder.score(query, unique)
            print(f"[RAG] CrossEncoder stage-1: {len(unique)} chunks scored")
        except Exception as exc:
            print(f"[RAG] CrossEncoder stage-1 failed ({type(exc).__name__}: {exc}); skipping")

    # ── Stage 2: LLM-as-judge reranking (best effort) ─────────────────────────
    if llm is not None and len(unique) > 1:
        try:
            scored = _llm_rerank_scores(query, unique, llm)
            top = scored[:top_k]
            print(f"[RAG] LLM stage-2 reranked {len(unique)} → {len(top)} chunks "
                  f"(scores: {[round(d.metadata.get('rerank_score', 0), 1) for d in top]})")
            return top
        except Exception as e:
            print(f"[RAG] LLM stage-2 rerank failed ({type(e).__name__}: {e}); using stage-1 order")

    print(f"[RAG] Deduped {len(docs)} → {len(unique[:top_k])} chunks")
    return unique[:top_k]


def _llm_rerank_scores(query, docs, llm):
    """
    Score each doc's relevance to the query (0–10) in a single LLM call.

    Returns the docs reordered by descending score, with
    metadata["rerank_score"] populated. Uses one batched prompt + a robust
    regex parse so a slightly-off model response still yields usable scores.
    """
    # Build a compact, numbered candidate list. Truncate each chunk hard so
    # even 20 candidates stay within the fast model's comfortable window.
    MAX_CHARS = 350
    candidates = []
    for i, doc in enumerate(docs):
        snippet = " ".join(doc.page_content[:MAX_CHARS].split())
        candidates.append(f"[{i}] {snippet}")

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are a relevance judge for a document search system. "
         "For each numbered text passage, score how relevant it is to the user's "
         "QUESTION on a scale of 0 to 10 (10 = directly answers it, 0 = unrelated). "
         "Be strict and concise.\n\n"
         "Respond with ONLY a JSON object mapping the passage index (as a string) "
         "to its integer score. Example: {{\"0\": 9, \"1\": 2}}.\n\n"
         "QUESTION: {question}\n\n"
         "PASSAGES:\n{passages}"),
        ("human", "Score each passage."),
    ])

    chain = prompt | llm | StrOutputParser()
    raw = chain.invoke({
        "question": query,
        "passages": "\n\n".join(candidates),
    })

    # ── Parse scores defensively (model may add prose / fence) ─────────────────
    scores = _parse_score_map(raw, expected=len(docs))

    # Attach scores and sort. Default missing/invalid scores to 0.
    for i, doc in enumerate(docs):
        doc.metadata["rerank_score"] = scores.get(i, 0)

    return sorted(docs, key=lambda d: d.metadata["rerank_score"], reverse=True)


def _parse_score_map(raw, expected):
    """
    Best-effort extraction of an {index: int score} map from the model output.

    Tries strict JSON first, then a lenient scan for '<number>: <number>' /
    '[<number>] <number>' patterns. Always returns a dict keyed by int index.
    """
    # 1) Strict JSON (possibly wrapped in ```json ... ``` fences)
    cleaned = raw.strip()
    fence = cleaned.find("```")
    if fence != -1:
        inner = cleaned[fence+3:]
        # skip an optional "json" language tag
        if inner.lstrip().lower().startswith("json"):
            inner = inner.lstrip()[4:]
        end = inner.find("```")
        if end != -1:
            inner = inner[:end]
        cleaned = inner.strip()

    try:
        obj = json.loads(cleaned)
        if isinstance(obj, dict):
            return {int(k): int(round(float(v))) for k, v in obj.items()}
    except Exception:
        pass

    # 2) Lenient regex: "<idx>: <score>" or "[idx] score"
    scores = {}
    for m in re.finditer(r'[\[\{"\']?(\d+)[\]"\']?\s*[:=]\s*([0-9]{1,2})', raw):
        idx = int(m.group(1))
        val = int(m.group(2))
        if 0 <= idx < expected and 0 <= val <= 10:
            scores[idx] = val
    return scores


# ── 4. QA Chain ───────────────────────────────────────────────────────────────
def build_qa_chain(vectorstore, chunks, groq_api_key, model_name="llama-3.1-8b-instant"):
    # Fallback order if a model hits rate limit
    fallback_models = [
        model_name,
        "llama-3.1-8b-instant",
        "gemma2-9b-it",
    ]
    # Remove duplicates while preserving order
    seen = set()
    fallback_models = [m for m in fallback_models if not (m in seen or seen.add(m))]

    llm = None
    for model in fallback_models:
        try:
            test_llm = ChatGroq(model_name=model, temperature=0, groq_api_key=groq_api_key)
            llm = test_llm
            print(f"[RAG] Using model: {model}")
            break
        except Exception:
            continue

    if llm is None:
        raise ValueError("All models failed. Check your Groq API key.")

    # Dedicated lightweight model for reranking. Reranking is latency-sensitive
    # and called on every turn, so it always uses the fast 8B model regardless
    # of the answer-generation model the user picked. Falls back to the main
    # llm on any init error.
    try:
        rerank_llm = ChatGroq(
            model_name=RERANK_MODEL, temperature=0, groq_api_key=groq_api_key
        )
    except Exception:
        rerank_llm = llm

    hybrid_retriever = build_hybrid_retriever(vectorstore, chunks)

    qa_prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are a helpful assistant answering questions about a PDF document. "
         "Use ONLY the context below to answer accurately and in detail. "
         "If the answer is not in the context, say 'I could not find that in the document.'\n\n"
         "Context:\n{context}"),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{question}"),
    ])

    def retrieve_and_rerank(x):
        query    = x["question"]
        docs     = hybrid_retriever.invoke(query)
        reranked = rerank_documents(query, docs, top_k=4, llm=rerank_llm)
        return "\n\n".join(doc.page_content for doc in reranked)

    chain = (
        RunnablePassthrough.assign(
            context=RunnableLambda(retrieve_and_rerank)
        )
        | qa_prompt
        | llm
        | StrOutputParser()
    )

    print(f"[RAG] QA chain ready — model: {model_name} | Hybrid + LLM Reranking ON")
    return {
        "chain"           : chain,
        "retriever"       : hybrid_retriever,
        "vectorstore"     : vectorstore,
        "llm"             : llm,
        "rerank_llm"      : rerank_llm,
        "chunks"          : chunks,
    }


def _confidence_score(docs):
    """
    Map the top chunk's LLM-judge rerank score (0–10) to a 1–5 star rating.

    Falls back to the old chunk-count heuristic only when no rerank scores are
    present (e.g. the lightweight path with no LLM reranking), so confidence is
    always meaningful, never fabricated.
    """
    if docs:
        top = docs[0].metadata.get("rerank_score")
        if top is not None:
            if top >= 8: return 5
            if top >= 6: return 4
            if top >= 4: return 3
            if top >= 2: return 2
    # Fallback: chunk-count heuristic from the original implementation.
    n = len(docs)
    if n >= 4: return 5
    if n == 3: return 4
    if n == 2: return 3
    if n == 1: return 2
    return 1

# ── 5. Ask ────────────────────────────────────────────────────────────────────
def ask(chain_dict, question, chat_history):
    import time
    chain      = chain_dict["chain"]
    retriever  = chain_dict["retriever"]
    rerank_llm = chain_dict.get("rerank_llm")

    messages = []
    for msg in chat_history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "bot":
            messages.append(AIMessage(content=msg["content"]))

    # Retry once on rate limit with a short wait
    for attempt in range(2):
        try:
            answer = chain.invoke({"question": question, "chat_history": messages})
            break
        except Exception as e:
            if "429" in str(e) and attempt == 0:
                print("[RAG] Rate limit hit, waiting 10s...")
                time.sleep(10)
            else:
                raise e

    # Get sources with reranking (LLM-as-judge when available)
    raw_docs  = retriever.invoke(question)
    top_docs  = rerank_documents(question, raw_docs, top_k=4, llm=rerank_llm)
    sources   = []
    for doc in top_docs:
        sources.append({
            "page"       : doc.metadata.get("page", 0) + 1,
            "snippet"    : doc.page_content[:300].strip(),
            "source_file": doc.metadata.get("source_file", ""),
            "score"      : doc.metadata.get("rerank_score"),
        })

    return {"answer": answer, "sources": sources, "confidence": _confidence_score(top_docs)}


# ── 6. Map-Reduce Summarization ───────────────────────────────────────────────
def summarize_pdf(chain_dict, num_pages):
    """
    Summarization strategy for free Groq tier:
    - Groups chunks into large batches (fewer API calls)
    - Summarizes each batch in one call
    - Combines batch summaries into final structured summary
    """
    import time
    llm         = chain_dict["llm"]
    vectorstore = chain_dict["vectorstore"]

    all_docs  = vectorstore.get()
    all_texts = all_docs.get("documents", [])

    if not all_texts:
        return "Could not retrieve document content."

    print(f"[RAG] Summarizing {len(all_texts)} chunks across {num_pages} pages...")

    # ── Batch chunks to minimize API calls ───────────────────────────────────
    # Join every 8 chunks into one batch, cap each batch at 2500 chars
    BATCH_SIZE  = 8
    CHARS_LIMIT = 2500

    batches = []
    for i in range(0, len(all_texts), BATCH_SIZE):
        group = all_texts[i:i + BATCH_SIZE]
        combined = " ".join(t.strip() for t in group)
        batches.append(combined[:CHARS_LIMIT])

    print(f"[RAG] {len(all_texts)} chunks → {len(batches)} batches")

    batch_prompt = ChatPromptTemplate.from_messages([
        ("system",
         "Summarize the following text in 3-5 sentences. "
         "Focus on key facts, concepts, and important details.\n\nText:\n{text}"),
        ("human", "Summarize."),
    ])
    batch_chain = batch_prompt | llm | StrOutputParser()

    batch_summaries = []
    for idx, batch in enumerate(batches):
        try:
            s = batch_chain.invoke({"text": batch})
            batch_summaries.append(s)
            print(f"[RAG] Batch {idx+1}/{len(batches)} done")
            time.sleep(1.5)   # stay well under TPM limit
        except Exception as e:
            err = str(e)
            if "413" in err or "429" in err:
                print(f"[RAG] Rate limit on batch {idx+1}, waiting 20s...")
                time.sleep(20)
                try:
                    s = batch_chain.invoke({"text": batch[:1500]})
                    batch_summaries.append(s)
                except Exception as e2:
                    print(f"[RAG] Skipping batch {idx+1}: {e2}")
            else:
                print(f"[RAG] Batch error: {e}")

    if not batch_summaries:
        return "Could not generate summary — all batches failed."

    print(f"[RAG] {len(batch_summaries)} batch summaries → generating final summary...")

    # ── Final reduce: combine batch summaries ─────────────────────────────────
    combined = "\n\n".join(f"- {s}" for s in batch_summaries)
    # Cap to ~3000 chars for the reduce call
    if len(combined) > 3000:
        step     = max(1, len(batch_summaries) // 20)
        selected = batch_summaries[::step][:20]
        combined = "\n\n".join(f"- {s}" for s in selected)

    reduce_prompt = ChatPromptTemplate.from_messages([
        ("system",
         f"You are summarizing a {num_pages}-page document. "
         f"Below are summaries of sections. Write a comprehensive structured summary.\n\n"
         f"Format:\n"
         f"## Overview\n(2-3 sentences)\n\n"
         f"## Main Topics\n(bullet points)\n\n"
         f"## Key Points\n(detailed bullets)\n\n"
         f"## Conclusion\n(1-2 sentences)\n\n"
         f"Section summaries:\n{{combined_summaries}}"),
        ("human", "Write the final summary."),
    ])
    reduce_chain = reduce_prompt | llm | StrOutputParser()

    try:
        final_summary = reduce_chain.invoke({"combined_summaries": combined})
    except Exception as e:
        if "413" in str(e) or "429" in str(e):
            time.sleep(20)
            final_summary = reduce_chain.invoke({"combined_summaries": combined[:2000]})
        else:
            raise e

    print("[RAG] Summary done")
    return final_summary


# ── 7. Study Notes ────────────────────────────────────────────────────────────
def generate_study_notes(chain_dict, num_pages):
    import time
    llm         = chain_dict["llm"]
    vectorstore = chain_dict["vectorstore"]

    all_docs  = vectorstore.get()
    all_texts = all_docs.get("documents", [])

    if not all_texts:
        return "Could not retrieve document content."

    print(f"[RAG] Generating study notes from {len(all_texts)} chunks...")

    # Batch chunks — 8 per batch, 2500 chars max
    BATCH_SIZE  = 8
    CHARS_LIMIT = 2500
    batches = []
    for i in range(0, len(all_texts), BATCH_SIZE):
        group    = all_texts[i:i + BATCH_SIZE]
        combined = " ".join(t.strip() for t in group)
        batches.append(combined[:CHARS_LIMIT])

    print(f"[RAG] {len(all_texts)} chunks → {len(batches)} batches")

    map_prompt = ChatPromptTemplate.from_messages([
        ("system",
         "Extract key concepts, definitions, and examples from this text. "
         "Be concise.\n\nText:\n{text}"),
        ("human", "Extract."),
    ])
    map_chain   = map_prompt | llm | StrOutputParser()
    batch_notes = []

    for idx, batch in enumerate(batches):
        try:
            note = map_chain.invoke({"text": batch})
            batch_notes.append(note)
            print(f"[RAG] Notes batch {idx+1}/{len(batches)} done")
            time.sleep(1.5)
        except Exception as e:
            err = str(e)
            if "413" in err or "429" in err:
                print(f"[RAG] Rate limit, waiting 20s...")
                time.sleep(20)
                try:
                    note = map_chain.invoke({"text": batch[:1500]})
                    batch_notes.append(note)
                except Exception as e2:
                    print(f"[RAG] Skipping batch {idx+1}: {e2}")
            else:
                print(f"[RAG] Batch error: {e}")

    if not batch_notes:
        return "Could not generate study notes — all batches failed."

    combined = "\n\n".join(batch_notes)
    if len(combined) > 3000:
        step     = max(1, len(batch_notes) // 20)
        selected = batch_notes[::step][:20]
        combined = "\n\n".join(selected)

    notes_prompt = ChatPromptTemplate.from_messages([
        ("system",
         f"Create student-friendly study notes from a {num_pages}-page document.\n\n"
         f"FORMAT EXACTLY:\n\n"
         f"# 📚 Study Notes: [Document Title]\n\n"
         f"## 🎯 What This Document Is About\n(2-3 sentences)\n\n"
         f"## 📖 Section 1: [Topic]\n"
         f"### What is it?\n(3-5 sentence explanation)\n"
         f"### Key Points\n- point\n"
         f"### 💡 Example\n(concrete example)\n\n"
         f"(repeat for each major topic)\n\n"
         f"## 🔑 Key Terms\n| Term | Definition |\n|------|------------|\n\n"
         f"## ⚡ Must Remember\n(5-8 complete sentences)\n\n"
         f"## 🗺️ Visual Overview\n(ASCII diagram with boxes and arrows)\n\n"
         f"## 📝 Practice Questions\n1.?\n2.?\n3.?\n4.?\n5.?\n\n"
         f"Concepts:\n{{combined_notes}}"),
        ("human", "Generate the study notes."),
    ])
    notes_chain = notes_prompt | llm | StrOutputParser()

    try:
        study_notes = notes_chain.invoke({"combined_notes": combined})
    except Exception as e:
        if "413" in str(e) or "429" in str(e):
            time.sleep(20)
            study_notes = notes_chain.invoke({"combined_notes": combined[:2000]})
        else:
            raise e

    print("[RAG] Study notes done")
    return study_notes


# ── 8. Suggested Questions ────────────────────────────────────────────────────
def generate_suggested_questions(chain_dict):
    llm      = chain_dict["llm"]
    retriever= chain_dict["retriever"]

    docs    = retriever.invoke("main topics key concepts important information")
    context = "\n\n".join(doc.page_content for doc in docs)

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "Generate exactly 5 specific questions a student might ask about this document. "
         "Return ONLY a numbered list (1. 2. 3. 4. 5.), nothing else.\n\nContext:\n{context}"),
        ("human", "Generate 5 questions."),
    ])
    chain  = prompt | llm | StrOutputParser()
    result = chain.invoke({"context": context})

    questions = []
    for line in result.strip().split("\n"):
        line = line.strip()
        if line and line[0].isdigit():
            q = line.split(". ", 1)[-1].strip()
            if q:
                questions.append(q)
    return questions[:5]


# ── 9. RAGAS Evaluation ───────────────────────────────────────────────────────
def evaluate_rag(chain_dict, test_questions: list) -> dict:
    """
    Evaluate RAG pipeline using RAGAS 0.4.x API:
    - Faithfulness: answer grounded in context (no hallucination)
    - Answer Relevancy: answer addresses the question
    - Context Precision: retrieved chunks are relevant
    """
    try:
        from ragas import evaluate, EvaluationDataset
        from ragas.metrics import faithfulness, answer_relevancy, context_precision
        from ragas.llms import LangchainLLMWrapper
        from ragas.embeddings import LangchainEmbeddingsWrapper
        from ragas import SingleTurnSample
    except ImportError as e:
        return {"error": f"RAGAS import failed: {e}. Run: pip install ragas datasets"}

    retriever  = chain_dict["retriever"]
    llm        = chain_dict["llm"]
    rerank_llm = chain_dict.get("rerank_llm")

    print(f"[RAGAS] Evaluating {len(test_questions)} questions...")

    samples = []
    for q in test_questions:
        try:
            result   = ask(chain_dict, q, [])
            answer   = result["answer"]
            raw_docs = retriever.invoke(q)
            top_docs = rerank_documents(q, raw_docs, top_k=4, llm=rerank_llm)
            contexts = [doc.page_content for doc in top_docs]

            samples.append(SingleTurnSample(
                user_input        = q,
                response          = answer,
                retrieved_contexts= contexts,
                reference         = "",   # not needed for these metrics
            ))
        except Exception as e:
            print(f"[RAGAS] Skipping '{q}': {e}")

    if not samples:
        return {"error": "No questions could be evaluated."}

    dataset   = EvaluationDataset(samples=samples)
    ragas_llm = LangchainLLMWrapper(llm)
    # Reuse the same cached embeddings (real MiniLM, or the lightweight
    # fallback) that the vector store uses — keeps memory use down and
    # avoids a second model load.
    ragas_emb = LangchainEmbeddingsWrapper(get_embeddings()[0])  # [0] = fn, [1] = is_fallback bool

    try:
        results = evaluate(
            dataset,
            metrics   = [faithfulness, answer_relevancy, context_precision],
            llm       = ragas_llm,
            embeddings= ragas_emb,
        )

        df = results.to_pandas()

        # Column names vary slightly by version — find them safely
        faith_col   = next((c for c in df.columns if "faith"   in c.lower()), None)
        relev_col   = next((c for c in df.columns if "relevan" in c.lower()), None)
        prec_col    = next((c for c in df.columns if "precis"  in c.lower()), None)

        def safe_mean(col):
            return round(float(df[col].mean()), 3) if col and col in df.columns else 0.0

        summary = {
            "faithfulness"     : safe_mean(faith_col),
            "answer_relevancy" : safe_mean(relev_col),
            "context_precision": safe_mean(prec_col),
            "per_question"     : df.to_dict("records"),
            "columns"          : list(df.columns),
        }
        print(f"[RAGAS] Done: {summary}")
        return summary

    except Exception as e:
        return {"error": f"Evaluation failed: {e}"}
