"""
app.py — Professional PDF Q&A Chatbot UI
"""
import os
import tempfile
import streamlit as st
from datetime import datetime
from rag_core import (
    load_and_split_multiple_pdfs, build_vectorstore, build_qa_chain,
    ask, summarize_pdf, generate_suggested_questions,
    generate_study_notes, evaluate_rag, GROQ_MODELS,
)

st.set_page_config(page_title="DocMind AI", page_icon="🧠", layout="wide")

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

* { font-family: 'Inter', sans-serif; }

/* ── Hide Streamlit defaults ── */
#MainMenu, footer, header { visibility: hidden; }
.block-container { padding: 0 !important; max-width: 100% !important; }
section[data-testid="stSidebar"] > div { padding-top: 0 !important; }

/* ── App background ── */
.stApp { background: #0f0f1a; color: #e2e8f0; }

/* ── Sidebar ── */
section[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #13131f 0%, #1a1a2e 100%);
    border-right: 1px solid #2d2d4e;
}

/* ── Logo area ── */
.logo-area {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 1.5rem 1.2rem;
    margin-bottom: 1rem;
    text-align: center;
}
.logo-title {
    font-size: 1.6rem; font-weight: 700;
    color: white; letter-spacing: 1px; margin: 0;
}
.logo-sub {
    font-size: 0.75rem; color: rgba(255,255,255,0.8);
    margin: 0.2rem 0 0 0; letter-spacing: 2px; text-transform: uppercase;
}

/* ── Sidebar labels ── */
.sidebar-label {
    font-size: 0.7rem; font-weight: 600; color: #667eea;
    text-transform: uppercase; letter-spacing: 1.5px;
    margin: 1rem 0 0.3rem 0;
}

/* ── Input fields ── */
.stTextInput input, .stTextArea textarea {
    background: #1e1e35 !important;
    border: 1px solid #2d2d4e !important;
    color: #e2e8f0 !important;
    border-radius: 8px !important;
}
.stTextInput input:focus, .stTextArea textarea:focus {
    border-color: #667eea !important;
    box-shadow: 0 0 0 2px rgba(102,126,234,0.2) !important;
}

/* ── Selectbox ── */
.stSelectbox > div > div {
    background: #1e1e35 !important;
    border: 1px solid #2d2d4e !important;
    color: #e2e8f0 !important;
    border-radius: 8px !important;
}

/* ── Buttons ── */
.stButton > button {
    background: linear-gradient(135deg, #667eea, #764ba2) !important;
    color: white !important; border: none !important;
    border-radius: 8px !important; font-weight: 600 !important;
    transition: all 0.2s ease !important;
}
.stButton > button:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 15px rgba(102,126,234,0.4) !important;
}

/* ── File uploader ── */
.stFileUploader {
    background: #1e1e35 !important;
    border: 2px dashed #2d2d4e !important;
    border-radius: 10px !important;
}

/* ── Tabs ── */
.stTabs [data-baseweb="tab-list"] {
    background: #13131f !important;
    border-bottom: 1px solid #2d2d4e !important;
    padding: 0 1.5rem !important;
    gap: 0 !important;
}
.stTabs [data-baseweb="tab"] {
    background: transparent !important;
    color: #8892b0 !important;
    border: none !important;
    padding: 1rem 1.5rem !important;
    font-weight: 500 !important;
    font-size: 0.9rem !important;
}
.stTabs [aria-selected="true"] {
    color: #667eea !important;
    border-bottom: 2px solid #667eea !important;
    background: transparent !important;
}
.stTabs [data-baseweb="tab-panel"] {
    background: #0f0f1a !important;
    padding: 1.5rem !important;
}

/* ── Chat header ── */
.chat-header {
    background: linear-gradient(135deg, #13131f, #1a1a2e);
    border-bottom: 1px solid #2d2d4e;
    padding: 1rem 1.5rem;
    display: flex; align-items: center; gap: 1rem;
}
.chat-header-title { font-size: 1.1rem; font-weight: 600; color: #e2e8f0; }
.chat-header-sub   { font-size: 0.8rem; color: #667eea; }
.status-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #48bb78; display: inline-block;
    box-shadow: 0 0 6px #48bb78; margin-right: 6px;
}

/* ── Chat messages ── */
.chat-area {
    padding: 1.5rem;
    min-height: 400px;
    max-height: 520px;
    overflow-y: auto;
}
.msg-row-user { display: flex; justify-content: flex-end; margin: 0.8rem 0; }
.msg-row-bot  { display: flex; justify-content: flex-start; margin: 0.8rem 0; align-items: flex-start; gap: 0.8rem; }

.bot-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; flex-shrink: 0;
}
.user-bubble {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white; padding: 0.75rem 1.1rem;
    border-radius: 18px 18px 4px 18px;
    max-width: 70%; font-size: 0.92rem; line-height: 1.6;
    box-shadow: 0 2px 12px rgba(102,126,234,0.3);
}
.bot-bubble {
    background: #1e1e35; color: #e2e8f0;
    padding: 0.75rem 1.1rem;
    border-radius: 18px 18px 18px 4px;
    max-width: 70%; font-size: 0.92rem; line-height: 1.6;
    border: 1px solid #2d2d4e;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
}
.msg-time { font-size: 0.7rem; color: #4a5568; margin-top: 0.3rem; text-align: right; }

/* ── Input bar ── */
.input-bar {
    background: #13131f;
    border-top: 1px solid #2d2d4e;
    padding: 1rem 1.5rem;
}

/* ── Source chips ── */
.source-chip {
    display: inline-block;
    background: #1e1e35; border: 1px solid #667eea;
    color: #667eea; border-radius: 20px;
    padding: 0.2rem 0.7rem; font-size: 0.75rem;
    margin: 0.2rem; cursor: pointer;
}
.source-box {
    background: #1a1a2e; border-left: 3px solid #667eea;
    padding: 0.7rem 1rem; border-radius: 0 8px 8px 0;
    margin: 0.4rem 0; font-size: 0.82rem; color: #a0aec0;
}

/* ── Metric cards ── */
.metric-card {
    background: linear-gradient(135deg, #1e1e35, #1a1a2e);
    border: 1px solid #2d2d4e; border-radius: 12px;
    padding: 1.2rem; text-align: center;
}
.metric-value { font-size: 2rem; font-weight: 700; color: #667eea; }
.metric-label { font-size: 0.8rem; color: #8892b0; text-transform: uppercase; letter-spacing: 1px; }

/* ── Suggested question pills ── */
.stButton > button[kind="secondary"] {
    background: #1e1e35 !important;
    border: 1px solid #667eea !important;
    color: #667eea !important;
    border-radius: 20px !important;
    font-size: 0.82rem !important;
    padding: 0.3rem 0.8rem !important;
}

/* ── Expander ── */
.streamlit-expanderHeader {
    background: #1e1e35 !important;
    border: 1px solid #2d2d4e !important;
    border-radius: 8px !important;
    color: #8892b0 !important;
}
.streamlit-expanderContent {
    background: #13131f !important;
    border: 1px solid #2d2d4e !important;
}

/* ── Slider ── */
.stSlider [data-baseweb="slider"] { background: #2d2d4e !important; }

/* ── Progress bar ── */
.stProgress > div > div { background: linear-gradient(90deg, #667eea, #764ba2) !important; }

/* ── Metrics ── */
[data-testid="stMetricValue"] { color: #667eea !important; font-weight: 700 !important; }
[data-testid="stMetricLabel"] { color: #8892b0 !important; }

/* ── Dataframe ── */
.stDataFrame { background: #1e1e35 !important; border-radius: 10px !important; }

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #13131f; }
::-webkit-scrollbar-thumb { background: #2d2d4e; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #667eea; }
</style>
""", unsafe_allow_html=True)

# ── Session state ─────────────────────────────────────────────────────────────
defaults = {
    "qa_chain": None, "chunks": [], "chat_history": [],
    "pdf_names": [], "num_pages": 0, "num_chunks": 0,
    "suggested_questions": [], "summary": None,
    "study_notes": None, "eval_results": None,
}
for k, v in defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("""
    <div class="logo-area">
        <p class="logo-title">🧠 DocMind AI</p>
        <p class="logo-sub">Intelligent Document Assistant</p>
    </div>
    """, unsafe_allow_html=True)

    st.markdown('<p class="sidebar-label">🔑 API Configuration</p>', unsafe_allow_html=True)
    groq_api_key = st.text_input("Groq API Key", type="password",
                                  placeholder="gsk_...", label_visibility="collapsed")
    st.markdown("<small style='color:#4a5568'>Free key → <a href='https://console.groq.com' target='_blank' style='color:#667eea'>console.groq.com</a></small>",
                unsafe_allow_html=True)

    st.markdown('<p class="sidebar-label">🤖 AI Model</p>', unsafe_allow_html=True)
    selected_model_label = st.selectbox("Model", list(GROQ_MODELS.keys()),
                                         index=0, label_visibility="collapsed")
    selected_model = GROQ_MODELS[selected_model_label]

    st.markdown('<p class="sidebar-label">⚙️ Chunking</p>', unsafe_allow_html=True)
    with st.expander("Advanced Settings"):
        chunk_size    = st.slider("Chunk Size",    300, 2000, 1000, 100)
        chunk_overlap = st.slider("Chunk Overlap",   0,  500,  200,  50)

    st.markdown('<p class="sidebar-label">📂 Documents</p>', unsafe_allow_html=True)
    uploaded_files = st.file_uploader("Upload PDF(s)", type=["pdf"],
                                       accept_multiple_files=True,
                                       label_visibility="collapsed")
    process_btn = st.button("⚡  Process Documents", use_container_width=True)

    if process_btn:
        if not groq_api_key:
            st.error("API key required.")
        elif not uploaded_files:
            st.error("Upload at least one PDF.")
        else:
            with st.spinner("Indexing documents..."):
                tmp_files = []
                try:
                    for uf in uploaded_files:
                        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
                        tmp.write(uf.read()); tmp.close()
                        tmp_files.append({"path": tmp.name, "name": uf.name})
                    chunks, total_pages = load_and_split_multiple_pdfs(
                        tmp_files, chunk_size, chunk_overlap)
                    vectorstore = build_vectorstore(chunks)
                    qa_chain    = build_qa_chain(vectorstore, chunks, groq_api_key, selected_model)
                    st.session_state.update({
                        "qa_chain": qa_chain, "chunks": chunks,
                        "pdf_names": [f["name"] for f in tmp_files],
                        "num_pages": total_pages, "num_chunks": len(chunks),
                        "chat_history": [], "suggested_questions": [],
                        "summary": None, "study_notes": None, "eval_results": None,
                    })
                    st.success(f"✅ {len(uploaded_files)} document(s) ready!")
                except Exception as e:
                    st.error(f"Error: {e}")
                finally:
                    for f in tmp_files:
                        try: os.unlink(f["path"])
                        except: pass

    # Stats panel
    if st.session_state.pdf_names:
        st.markdown("---")
        st.markdown('<p class="sidebar-label">📊 Loaded Documents</p>', unsafe_allow_html=True)
        for name in st.session_state.pdf_names:
            st.markdown(f"<small style='color:#8892b0'>📄 {name}</small>", unsafe_allow_html=True)
        c1, c2 = st.columns(2)
        c1.metric("Pages",  st.session_state.num_pages)
        c2.metric("Chunks", st.session_state.num_chunks)
        st.markdown("<small style='color:#667eea'>🔍 Hybrid Search + Reranking ON</small>",
                    unsafe_allow_html=True)

    st.markdown("---")
    if st.session_state.chat_history:
        chat_text  = f"DocMind AI — Export {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
        chat_text += f"Documents: {', '.join(st.session_state.pdf_names)}\n{'='*60}\n\n"
        for msg in st.session_state.chat_history:
            role = "You" if msg["role"] == "user" else "DocMind"
            chat_text += f"{role}:\n{msg['content']}\n\n"
        st.download_button("💾 Export Conversation", chat_text,
                           f"docmind_{datetime.now().strftime('%Y%m%d_%H%M')}.txt",
                           "text/plain", use_container_width=True)

    if st.button("🗑️  Clear Session", use_container_width=True):
        for k in ["chat_history", "suggested_questions"]:
            st.session_state[k] = []
        for k in ["summary", "study_notes", "eval_results"]:
            st.session_state[k] = None
        st.rerun()

    st.markdown("<br><small style='color:#2d2d4e'>LangChain · ChromaDB · BM25 · CrossEncoder<br>Groq Llama 3 · HuggingFace · Streamlit</small>",
                unsafe_allow_html=True)

# ── Main area ─────────────────────────────────────────────────────────────────
# Header bar
status = "🟢 Ready" if st.session_state.qa_chain else "⚪ No Document Loaded"
doc_info = f"  ·  {', '.join(st.session_state.pdf_names)}" if st.session_state.pdf_names else ""
st.markdown(f"""
<div class="chat-header">
    <div>
        <div class="chat-header-title">🧠 DocMind AI</div>
        <div class="chat-header-sub">{status}{doc_info}</div>
    </div>
</div>
""", unsafe_allow_html=True)

# ── Tabs ──────────────────────────────────────────────────────────────────────
tab1, tab2, tab3, tab4 = st.tabs([
    "💬  Chat",
    "📝  Summary",
    "🎓  Study Notes",
    "📊  Evaluation",
])

# ════════════════════════════════════════════════════════════════════════════
# TAB 1 — CHAT
# ════════════════════════════════════════════════════════════════════════════
with tab1:
    # Suggested questions
    if st.session_state.qa_chain:
        col_sq, col_clear = st.columns([3, 1])
        with col_sq:
            if st.button("💡  Generate Suggested Questions", use_container_width=True):
                with st.spinner("Thinking of questions..."):
                    try:
                        st.session_state.suggested_questions = generate_suggested_questions(
                            st.session_state.qa_chain)
                    except Exception as e:
                        st.error(str(e))

    if st.session_state.suggested_questions:
        st.markdown("<p style='color:#8892b0; font-size:0.82rem; margin:0.5rem 0 0.3rem'>💡 <b>Suggested — click to ask:</b></p>",
                    unsafe_allow_html=True)
        cols = st.columns(min(len(st.session_state.suggested_questions), 3))
        for i, q in enumerate(st.session_state.suggested_questions):
            with cols[i % 3]:
                if st.button(q, key=f"sq_{i}"):
                    st.session_state.chat_history.append({"role": "user", "content": q,
                                                           "time": datetime.now().strftime("%H:%M")})
                    with st.spinner(""):
                        try:
                            resp = ask(st.session_state.qa_chain, q, st.session_state.chat_history)
                            st.session_state.chat_history.append({
                                "role": "bot", "content": resp["answer"],
                                "sources": resp["sources"],
                                "time": datetime.now().strftime("%H:%M"),
                            })
                        except Exception as e:
                            st.session_state.chat_history.append({
                                "role": "bot", "content": f"⚠️ {e}",
                                "sources": [], "time": datetime.now().strftime("%H:%M"),
                            })
                    st.rerun()

    st.markdown("---")

    # Chat messages
    if not st.session_state.chat_history:
        if st.session_state.qa_chain:
            st.markdown("""
            <div style='text-align:center; padding:3rem; color:#4a5568;'>
                <div style='font-size:3rem'>🧠</div>
                <div style='font-size:1.1rem; color:#8892b0; margin-top:0.5rem'>Document loaded and ready</div>
                <div style='font-size:0.85rem; margin-top:0.3rem'>Ask anything about your document below</div>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown("""
            <div style='text-align:center; padding:3rem; color:#4a5568;'>
                <div style='font-size:3rem'>📄</div>
                <div style='font-size:1.1rem; color:#8892b0; margin-top:0.5rem'>No document loaded</div>
                <div style='font-size:0.85rem; margin-top:0.3rem'>Upload a PDF in the sidebar to get started</div>
            </div>
            """, unsafe_allow_html=True)
    else:
        for msg in st.session_state.chat_history:
            t = msg.get("time", "")
            if msg["role"] == "user":
                st.markdown(f"""
                <div class="msg-row-user">
                    <div>
                        <div class="user-bubble">{msg["content"]}</div>
                        <div class="msg-time">{t}</div>
                    </div>
                </div>""", unsafe_allow_html=True)
            else:
                st.markdown(f"""
                <div class="msg-row-bot">
                    <div class="bot-avatar">🧠</div>
                    <div>
                        <div class="bot-bubble">{msg["content"]}</div>
                        <div class="msg-time">{t}</div>
                    </div>
                </div>""", unsafe_allow_html=True)
                if msg.get("sources"):
                    with st.expander(f"📚  {len(msg['sources'])} source chunks used"):
                        for i, src in enumerate(msg["sources"], 1):
                            fl = f" · {src['source_file']}" if src.get("source_file") else ""
                            st.markdown(
                                f'<div class="source-box">'
                                f'<span class="source-chip">Page {src["page"]}{fl}</span><br><br>'
                                f'{src["snippet"]}...'
                                f'</div>', unsafe_allow_html=True)

    # Input bar
    st.markdown("---")
    with st.form("chat_form", clear_on_submit=True):
        c1, c2 = st.columns([6, 1])
        with c1:
            user_q = st.text_input("message", placeholder="Ask anything about your document...",
                                   label_visibility="collapsed")
        with c2:
            send = st.form_submit_button("Send  ➤", use_container_width=True)

    if send and user_q:
        if not st.session_state.qa_chain:
            st.warning("Please upload and process a document first.")
        else:
            st.session_state.chat_history.append({
                "role": "user", "content": user_q,
                "time": datetime.now().strftime("%H:%M"),
            })
            with st.spinner(""):
                try:
                    resp = ask(st.session_state.qa_chain, user_q, st.session_state.chat_history)
                    st.session_state.chat_history.append({
                        "role": "bot", "content": resp["answer"],
                        "sources": resp["sources"],
                        "time": datetime.now().strftime("%H:%M"),
                    })
                except Exception as e:
                    st.session_state.chat_history.append({
                        "role": "bot", "content": f"⚠️ {e}",
                        "sources": [], "time": datetime.now().strftime("%H:%M"),
                    })
            st.rerun()

# ════════════════════════════════════════════════════════════════════════════
# TAB 2 — SUMMARY
# ════════════════════════════════════════════════════════════════════════════
with tab2:
    st.markdown("""
    <div style='margin-bottom:1.5rem'>
        <h3 style='color:#e2e8f0; margin:0'>📝 Document Summary</h3>
        <p style='color:#8892b0; font-size:0.85rem; margin:0.3rem 0 0'>
        Uses <b style='color:#667eea'>Map-Reduce</b> — reads every chunk, summarizes each one,
        then combines into a full structured summary covering the entire document.
        </p>
    </div>
    """, unsafe_allow_html=True)

    if st.session_state.qa_chain:
        if st.button("📝  Generate Full Summary", use_container_width=True):
            with st.spinner(f"Reading all {st.session_state.num_pages} pages... (~30-60s)"):
                try:
                    st.session_state.summary = summarize_pdf(
                        st.session_state.qa_chain, st.session_state.num_pages)
                except Exception as e:
                    st.error(str(e))
    else:
        st.info("👈 Upload and process a document first.")

    if st.session_state.summary:
        st.markdown(f"""
        <div style='background:#1e1e35; border:1px solid #2d2d4e; border-radius:12px; padding:1.5rem; margin-top:1rem'>
        """, unsafe_allow_html=True)
        st.markdown(st.session_state.summary)
        st.markdown("</div>", unsafe_allow_html=True)
        st.download_button("⬇️  Download Summary (.md)", st.session_state.summary,
                           "summary.md", "text/markdown", use_container_width=True)

# ════════════════════════════════════════════════════════════════════════════
# TAB 3 — STUDY NOTES
# ════════════════════════════════════════════════════════════════════════════
with tab3:
    st.markdown("""
    <div style='margin-bottom:1.5rem'>
        <h3 style='color:#e2e8f0; margin:0'>🎓 Study Notes</h3>
        <p style='color:#8892b0; font-size:0.85rem; margin:0.3rem 0 0'>
        Generates structured notes with <b style='color:#667eea'>explanations · examples ·
        key terms · visual overview · practice questions</b> — designed for students.
        </p>
    </div>
    """, unsafe_allow_html=True)

    if st.session_state.qa_chain:
        if st.button("🎓  Generate Study Notes", use_container_width=True):
            with st.spinner(f"Creating notes for {st.session_state.num_pages} pages... (~1-2 min)"):
                try:
                    st.session_state.study_notes = generate_study_notes(
                        st.session_state.qa_chain, st.session_state.num_pages)
                except Exception as e:
                    st.error(str(e))
    else:
        st.info("👈 Upload and process a document first.")

    if st.session_state.study_notes:
        st.markdown("""
        <div style='background:#1e1e35; border:1px solid #2d2d4e; border-radius:12px; padding:1.5rem; margin-top:1rem'>
        """, unsafe_allow_html=True)
        st.markdown(st.session_state.study_notes)
        st.markdown("</div>", unsafe_allow_html=True)
        st.download_button("⬇️  Download Study Notes (.md)", st.session_state.study_notes,
                           "study_notes.md", "text/markdown", use_container_width=True)

# ════════════════════════════════════════════════════════════════════════════
# TAB 4 — RAGAS EVALUATION
# ════════════════════════════════════════════════════════════════════════════
with tab4:
    st.markdown("""
    <div style='margin-bottom:1.5rem'>
        <h3 style='color:#e2e8f0; margin:0'>📊 RAG Evaluation</h3>
        <p style='color:#8892b0; font-size:0.85rem; margin:0.3rem 0 0'>
        Automatically scores your RAG pipeline using <b style='color:#667eea'>RAGAS</b> metrics.
        </p>
    </div>
    """, unsafe_allow_html=True)

    # Metric explanation cards
    c1, c2, c3 = st.columns(3)
    with c1:
        st.markdown("""<div class="metric-card">
            <div style='font-size:1.5rem'>🎯</div>
            <div style='color:#e2e8f0; font-weight:600; margin:0.3rem 0'>Faithfulness</div>
            <div style='color:#8892b0; font-size:0.8rem'>Answer is grounded in the document — no hallucination</div>
        </div>""", unsafe_allow_html=True)
    with c2:
        st.markdown("""<div class="metric-card">
            <div style='font-size:1.5rem'>💬</div>
            <div style='color:#e2e8f0; font-weight:600; margin:0.3rem 0'>Answer Relevancy</div>
            <div style='color:#8892b0; font-size:0.8rem'>Answer actually addresses the question asked</div>
        </div>""", unsafe_allow_html=True)
    with c3:
        st.markdown("""<div class="metric-card">
            <div style='font-size:1.5rem'>🔍</div>
            <div style='color:#e2e8f0; font-weight:600; margin:0.3rem 0'>Context Precision</div>
            <div style='color:#8892b0; font-size:0.8rem'>Retrieved chunks are relevant to the question</div>
        </div>""", unsafe_allow_html=True)

    st.markdown("<p style='color:#4a5568; font-size:0.8rem; text-align:center; margin:0.5rem 0'>Score: 0.0 (worst) → 1.0 (best)</p>",
                unsafe_allow_html=True)
    st.markdown("---")

    if st.session_state.qa_chain:
        default_qs = "\n".join(st.session_state.suggested_questions) if st.session_state.suggested_questions \
            else "What is the main topic of this document?\nWhat are the key concepts explained?\nWhat conclusions does the document make?"
        st.markdown("<p style='color:#8892b0; font-size:0.85rem'>Enter test questions (one per line):</p>",
                    unsafe_allow_html=True)
        test_input = st.text_area("Questions", value=default_qs, height=130,
                                   label_visibility="collapsed")
        if st.button("🧪  Run Evaluation", use_container_width=True, type="primary"):
            questions = [q.strip() for q in test_input.strip().split("\n") if q.strip()]
            if not questions:
                st.warning("Enter at least one question.")
            else:
                with st.spinner(f"Evaluating {len(questions)} questions... (~2-3 min)"):
                    try:
                        st.session_state.eval_results = evaluate_rag(
                            st.session_state.qa_chain, questions)
                    except Exception as e:
                        st.error(str(e))
    else:
        st.info("👈 Upload and process a document first.")

    if st.session_state.eval_results:
        results = st.session_state.eval_results
        if "error" in results:
            st.error(results["error"])
            st.code("pip install ragas datasets")
        else:
            st.markdown("### Overall Scores")
            c1, c2, c3, c4 = st.columns(4)

            def badge(score):
                if score >= 0.8: return "🟢", "#48bb78"
                if score >= 0.6: return "🟡", "#ecc94b"
                return "🔴", "#fc8181"

            overall = (results['faithfulness'] + results['answer_relevancy'] + results['context_precision']) / 3
            for col, label, val in [
                (c1, "Faithfulness",      results['faithfulness']),
                (c2, "Answer Relevancy",  results['answer_relevancy']),
                (c3, "Context Precision", results['context_precision']),
                (c4, "Overall Score",     overall),
            ]:
                icon, color = badge(val)
                col.markdown(f"""<div class="metric-card">
                    <div class="metric-value" style='color:{color}'>{val:.2f}</div>
                    <div class="metric-label">{icon} {label}</div>
                </div>""", unsafe_allow_html=True)

            st.markdown("<br>", unsafe_allow_html=True)
            st.progress(overall)
            st.markdown(f"<p style='color:#8892b0; font-size:0.85rem; text-align:center'>Overall RAG Quality: <b style='color:#667eea'>{overall:.1%}</b></p>",
                        unsafe_allow_html=True)

            st.markdown("### Per-Question Breakdown")
            import pandas as pd
            df = pd.DataFrame(results["per_question"])
            show_cols = [c for c in df.columns if c in [
                "user_input", "response", "faithfulness",
                "answer_relevancy", "context_precision"]]
            st.dataframe(df[show_cols] if show_cols else df, use_container_width=True)
            st.download_button("⬇️  Download Report (.csv)",
                               df.to_csv(index=False), "rag_evaluation.csv",
                               "text/csv", use_container_width=True)
