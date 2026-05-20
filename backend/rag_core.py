"""
rag_core.py — Advanced RAG Pipeline
Features:
  - Multi-PDF ingestion & chunking
  - HuggingFace local embeddings
  - ChromaDB vector store
  - BM25 keyword search + Vector search (Hybrid)
  - Cross-Encoder Reranking
  - Groq LLM (Llama 3.1)
  - Map-Reduce summarization
  - Study notes generation
  - Suggested questions
  - RAGAS evaluation
"""

import os
import shutil
import time
from dotenv import load_dotenv

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings

load_dotenv()

# ── Constants ─────────────────────────────────────────────────────────────────
CHROMA_DIR      = "chroma_db"
EMBEDDING_MODEL = "text-embedding-3-small"   # OpenAI API — no local RAM needed

GROQ_MODELS = {
    "Llama 3.1 8B (Fast)"         : "llama-3.1-8b-instant",
    "Llama 3.3 70B (Best Quality)": "llama-3.3-70b-versatile",
    "Gemma 2 9B"                  : "gemma2-9b-it",
}


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
def build_vectorstore(chunks, collection_name="pdf_collection"):
    embeddings = OpenAIEmbeddings(
        model          = EMBEDDING_MODEL,
        openai_api_key = os.getenv("OPENAI_API_KEY", ""),
    )

    # Use in-memory ChromaDB — works on all cloud platforms (no disk needed)
    import chromadb as _chromadb
    chroma_client = _chromadb.EphemeralClient()

    # Clean up any leftover persistent store on disk
    if os.path.exists(CHROMA_DIR):
        try:
            old = _chromadb.PersistentClient(path=CHROMA_DIR)
            old.reset(); del old
        except Exception:
            pass
        try:
            shutil.rmtree(CHROMA_DIR)
        except Exception:
            pass

    vectorstore = Chroma.from_documents(
        documents       = chunks,
        embedding       = embeddings,
        client          = chroma_client,
        collection_name = collection_name,
    )
    print(f"[RAG] Vector store built with {len(chunks)} chunks (in-memory)")
    return vectorstore


# ── 3. Hybrid Retriever (BM25 + Vector + Reranker) ────────────────────────────
def build_hybrid_retriever(vectorstore, chunks, k=6):
    """
    Combines BM25 (keyword) + MMR vector search, then reranks with cross-encoder.
    BM25  → good for exact terms, names, codes
    Vector → good for semantic/conceptual questions
    Reranker → picks the truly best chunks from combined results
    """
    # BM25 retriever (keyword-based)
    bm25_retriever = BM25Retriever.from_documents(chunks)
    bm25_retriever.k = k

    # Vector retriever (semantic)
    vector_retriever = vectorstore.as_retriever(
        search_type   = "mmr",
        search_kwargs = {"k": k, "fetch_k": 20},
    )

    # Ensemble: 40% BM25 + 60% vector
    ensemble_retriever = EnsembleRetriever(
        retrievers = [bm25_retriever, vector_retriever],
        weights    = [0.4, 0.6],
    )

    print("[RAG] Hybrid retriever (BM25 + Vector) ready")
    return ensemble_retriever


def rerank_documents(query, docs, top_k=4):
    """
    Lightweight reranking without CrossEncoder (saves ~400MB RAM).
    Deduplicates by content similarity and returns top_k unique chunks.
    """
    if not docs:
        return docs
    seen = set()
    unique = []
    for doc in docs:
        key = doc.page_content[:100]
        if key not in seen:
            seen.add(key)
            unique.append(doc)
    print(f"[RAG] Deduped {len(docs)} -> {len(unique[:top_k])} chunks")
    return unique[:top_k]


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
        reranked = rerank_documents(query, docs, top_k=4)
        return "\n\n".join(doc.page_content for doc in reranked)

    chain = (
        RunnablePassthrough.assign(
            context=RunnableLambda(retrieve_and_rerank)
        )
        | qa_prompt
        | llm
        | StrOutputParser()
    )

    print(f"[RAG] QA chain ready — model: {model_name} | Hybrid + Reranking ON")
    return {
        "chain"           : chain,
        "retriever"       : hybrid_retriever,
        "vectorstore"     : vectorstore,
        "llm"             : llm,
        "chunks"          : chunks,
    }


# ── 5. Ask ────────────────────────────────────────────────────────────────────
def ask(chain_dict, question, chat_history):
    import time
    chain     = chain_dict["chain"]
    retriever = chain_dict["retriever"]

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

    # Get sources with reranking
    raw_docs  = retriever.invoke(question)
    top_docs  = rerank_documents(question, raw_docs, top_k=4)
    sources   = []
    for doc in top_docs:
        sources.append({
            "page"       : doc.metadata.get("page", 0) + 1,
            "snippet"    : doc.page_content[:300].strip(),
            "source_file": doc.metadata.get("source_file", ""),
        })

    return {"answer": answer, "sources": sources}


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
        from langchain_community.embeddings import HuggingFaceEmbeddings
    except ImportError as e:
        return {"error": f"RAGAS import failed: {e}. Run: pip install ragas datasets"}

    retriever = chain_dict["retriever"]
    llm       = chain_dict["llm"]

    print(f"[RAGAS] Evaluating {len(test_questions)} questions...")

    samples = []
    for q in test_questions:
        try:
            result   = ask(chain_dict, q, [])
            answer   = result["answer"]
            raw_docs = retriever.invoke(q)
            top_docs = rerank_documents(q, raw_docs, top_k=4)
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
    ragas_emb = LangchainEmbeddingsWrapper(
        HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    )

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
