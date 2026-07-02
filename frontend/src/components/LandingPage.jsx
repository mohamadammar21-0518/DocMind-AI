import { useRef, useState, useEffect, useCallback } from 'react'
import { SignInButton, SignUpButton, UserButton, useUser } from '@clerk/clerk-react'
import {
  Menu, X, Plus, Clock, Zap, ChevronDown,
  Upload, ArrowUp, BookOpen, BarChart2, MessageSquare,
  FileText, Bot, User, Sparkles, Mic, MicOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useDictation } from '../hooks/useDictation'

/* ── Demo chat knowledge base ───────────────────────────────────────────────
   Keyword-matched responses that simulate the AI explaining itself.
   Shown with a typewriter effect before the user signs in.
─────────────────────────────────────────────────────────────────────────── */
const DEMO_RESPONSES = [
  {
    keywords: ['how', 'work', 'what', 'docmind', 'tell me', 'explain', 'about'],
    answer: `**DocMind AI** is a PDF reasoning workspace — you upload any document and have a real conversation with it.

Here's how it works:

1. **Upload a PDF** — research papers, textbooks, reports, contracts, anything
2. **Ask questions** in plain English — "What's the main argument?" or "Summarize chapter 3"
3. **Get grounded answers** — every response cites the exact page it came from
4. **Switch modes** — use Chat, Summary, Study Notes, or Evaluation tabs

The AI reads your document, indexes it into chunks, and uses retrieval-augmented generation (RAG) to answer only from what's actually in your file — no hallucinations from general knowledge.`,
  },
  {
    keywords: ['upload', 'pdf', 'document', 'file'],
    answer: `**Uploading is simple:**

- Click the **upload icon** in the sidebar (after signing in)
- Drag and drop one or more PDFs — up to **15MB** each
- Multiple PDFs can be loaded at once for cross-document questions

Once uploaded, DocMind splits your PDF into smart chunks, embeds them into a vector store, and builds a RAG chain on top. The whole process takes about **10–20 seconds** depending on the file size.

Then you can start asking questions immediately.`,
  },
  {
    keywords: ['summary', 'summarize', 'overview', 'tldr'],
    answer: `The **Summary tab** gives you an instant overview of your entire document.

DocMind reads through all the content and generates:
- A **concise summary** of the main topics
- **Key takeaways** from the document
- The document's **core argument or purpose**

You can use this to quickly decide if a paper is worth reading in depth, or to refresh your memory on something you've already read.`,
  },
  {
    keywords: ['study', 'notes', 'learn', 'flash', 'revision'],
    answer: `The **Study Notes tab** transforms your document into structured learning material.

It generates:
- **Bullet-point notes** organized by topic
- **Key definitions** and concepts
- **Important facts** worth remembering
- A format that's easy to review before an exam

This is especially useful for textbooks, lecture slides, or research papers where you need to retain the information — not just read it once.`,
  },
  {
    keywords: ['evaluat', 'score', 'accuracy', 'test', 'assess', 'quality'],
    answer: `The **Evaluation tab** lets you measure how well DocMind is answering questions about your document.

You provide a set of test questions and it scores the answers using **RAGAS metrics**:
- **Faithfulness** — are answers grounded in the document?
- **Answer Relevancy** — do they actually address the question?
- **Context Precision** — is the right context being retrieved?

This is useful if you're using DocMind for professional or academic work and need to validate the quality of AI responses.`,
  },
  {
    keywords: ['source', 'citation', 'reference', 'page', 'hallucin'],
    answer: `DocMind is designed to **never hallucinate** answers from general knowledge.

Every response includes:
- **Page citations** — the exact page number the answer came from
- **Source snippets** — the raw text used to generate the answer
- **Confidence score** — how well the retrieved context matched your question

If your PDF doesn't contain the answer, DocMind will tell you that rather than making something up. This is the core advantage of RAG over a standard chatbot.`,
  },
  {
    keywords: ['free', 'cost', 'price', 'plan', 'paid', 'subscription'],
    answer: `DocMind AI is **free to use** — just create an account and start uploading documents.

The system runs on the **Groq API** for ultra-fast LLM inference (typically sub-second token generation). You can optionally bring your own Groq API key for higher rate limits.

No subscription required, no credit card needed to get started.`,
  },
  {
    keywords: ['model', 'llm', 'ai', 'llama', 'groq', 'gpt', 'language'],
    answer: `DocMind uses **Llama 3.1** models via the Groq API — one of the fastest inference providers available.

Available models:
- **Llama 3.1 8B** — fastest, great for most questions
- **Llama 3.1 70B** — more nuanced reasoning, slightly slower
- **Llama 3.3 70B** — best quality for complex documents

You can switch models in the sidebar. The vector store and retrieval layer are built with **ChromaDB** and **LangChain**.`,
  },
  {
    keywords: ['chat', 'ask', 'question', 'convers'],
    answer: `The **Chat tab** is the heart of DocMind — a conversation interface grounded in your document.

You can:
- Ask **specific questions** ("What does the paper say about method X?")
- Ask for **comparisons** ("How does section 2 differ from section 4?")
- Ask for **explanations** ("Explain this concept in simple terms")
- Have a **back-and-forth conversation** — the AI remembers your chat history

Responses stream in real-time so you're not waiting for the full answer to generate.`,
  },
]

const FALLBACK_RESPONSE = `That's a great question! I can tell you about **how DocMind AI works**, including:

- 📄 **Uploading PDFs** and how documents are indexed
- 💬 **Chat mode** — asking questions grounded in your document
- 📝 **Summaries** and study note generation
- 🔍 **Source citations** and how we avoid hallucinations
- ⚙️ **Models** available and how to configure them

What would you like to know more about?`

function getDemoResponse(input) {
  const lower = input.toLowerCase()
  for (const { keywords, answer } of DEMO_RESPONSES) {
    if (keywords.some((kw) => lower.includes(kw))) return answer
  }
  return FALLBACK_RESPONSE
}

/* ── Suggestion cards ──────────────────────────────────────────────────────── */
const SUGGESTIONS = [
  { icon: '💬', text: 'How does DocMind work?' },
  { icon: '📄', text: 'How do I upload a PDF?' },
  { icon: '📝', text: 'What are study notes?' },
  { icon: '🔍', text: 'Do answers have citations?' },
]

/* ── Simple markdown renderer (bold + lists only) ──────────────────────────── */
function SimpleMarkdown({ text }) {
  const lines = text.split('\n')
  const elements = []
  let listItems = []

  const flushList = () => {
    if (listItems.length) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="lp-demo-list">
          {listItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </ul>
      )
      listItems = []
    }
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    const formatted = trimmed
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')

    if (trimmed.startsWith('- ') || /^\d+\./.test(trimmed)) {
      const content = trimmed.replace(/^[-\d.]+\s*/, '')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
      listItems.push(content)
    } else {
      flushList()
      if (!trimmed) {
        elements.push(<span key={i} className="lp-demo-spacer" />)
      } else {
        elements.push(
          <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />
        )
      }
    }
  })
  flushList()
  return <div className="lp-demo-md">{elements}</div>
}

/* ── Typewriter hook ─────────────────────────────────────────── */
function useTypewriter(text, speed = 12) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    if (!text) return
    let i = 0
    const tick = () => {
      i += Math.floor(Math.random() * 3) + 1  // variable speed for realism
      setDisplayed(text.slice(0, i))
      if (i < text.length) {
        setTimeout(tick, speed)
      } else {
        setDisplayed(text)
        setDone(true)
      }
    }
    setTimeout(tick, speed)
  }, [text, speed])

  return { displayed, done }
}

/* ── Bot message with typewriter ────────────────────────────── */
function BotMessage({ text, isLatest }) {
  const { displayed, done } = useTypewriter(isLatest ? text : null)
  const content = isLatest ? displayed : text

  return (
    <div className="lp-msg lp-msg--bot">
      <div className="lp-msg-avatar lp-msg-avatar--bot">
        <Bot size={16} />
      </div>
      <div className="lp-msg-bubble lp-msg-bubble--bot">
        <SimpleMarkdown text={content} />
        {isLatest && !done && <span className="lp-cursor" />}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Main Landing Page
═══════════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { isSignedIn } = useUser()
  const [prompt, setPrompt]               = useState('')
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const [messages, setMessages]           = useState([])
  const [isTyping, setIsTyping]           = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)

  const composerRef  = useRef(null)
  const scrollAnchor = useRef(null)
  const hasChatted   = messages.length > 0

  const { listening, supported: micSupported, toggle: toggleMic } = useDictation()

  const handleMicToggle = () => {
    if (!micSupported) {
      toast.error('Your browser does not support voice input')
      return
    }
    toggleMic(
      (text) => setPrompt(text),  // single callback — no duplication
      prompt                       // pass current prompt so it appends
    )
    if (!listening) toast('Listening… speak now', { icon: '🎙️', duration: 2000 })
  }

  /* Auto-grow textarea */
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [prompt])

  /* Scroll to bottom on new messages */
  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  /* Close sidebar on outside click */
  useEffect(() => {
    if (!sidebarOpen) return
    const handler = (e) => {
      if (!e.target.closest('.lp-sidebar') && !e.target.closest('.lp-hamburger')) {
        setSidebarOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sidebarOpen])

  const focusComposer = () => composerRef.current?.focus()

  const sendMessage = useCallback((text) => {
    const trimmed = text.trim()
    if (!trimmed || isTyping) return

    setShowSuggestions(false)
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }])
    setPrompt('')
    setIsTyping(true)

    // Simulate a small thinking delay
    setTimeout(() => {
      const answer = getDemoResponse(trimmed)
      setMessages((prev) => [...prev, { role: 'bot', text: answer }])
      setIsTyping(false)
    }, 600)
  }, [isTyping])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isSignedIn) {
      toast('You\'re signed in! Upload a PDF in the workspace to get started.')
      return
    }
    sendMessage(prompt)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleSuggestion = (text) => {
    if (isSignedIn) {
      toast('Upload a PDF in the workspace to start chatting with your documents.')
      return
    }
    sendMessage(text)
  }

  return (
    <div className="lp-root">
      {/* Backdrop */}
      {sidebarOpen && (
        <div className="lp-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className={`lp-sidebar${sidebarOpen ? ' lp-sidebar--open' : ''}`}>
        <div className="lp-sidebar-header">
          <div className="lp-sidebar-brand">
            <img src="/logo.png" alt="DocMind AI" className="lp-sidebar-logo" />
            <span className="lp-sidebar-brandname">DocMind AI</span>
          </div>
          <button
            type="button"
            className="lp-icon-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="lp-sidebar-body">
          <button
            type="button"
            className="lp-new-chat-btn"
            onClick={() => {
              setMessages([])
              setShowSuggestions(true)
              setSidebarOpen(false)
              setTimeout(focusComposer, 100)
            }}
          >
            <Plus size={16} />
            New session
          </button>

          <p className="lp-sidebar-section-label">Recent</p>
          <div className="lp-sidebar-empty-state">
            <Clock size={22} />
            <p>No sessions yet</p>
            <span>Sign in and upload a PDF to save your sessions</span>
          </div>
        </div>

        {!isSignedIn && (
          <div className="lp-sidebar-footer">
            <div className="lp-upgrade-card">
              <Zap size={16} className="lp-upgrade-icon" />
              <strong>Chat with your own PDFs</strong>
              <p>Upload any document and ask questions grounded in your content — with citations.</p>
              <SignInButton mode="modal" asChild>
                <button type="button" className="lp-upgrade-btn">Log in to DocMind</button>
              </SignInButton>
              <SignUpButton mode="modal" asChild>
                <button type="button" className="lp-signup-link">Create free account →</button>
              </SignUpButton>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <div className="lp-main">

        {/* Top bar */}
        <header className="lp-topbar">
          <div className="lp-topbar-left">
            <button
              type="button"
              className={`lp-icon-btn lp-hamburger${sidebarOpen ? ' lp-hamburger--active' : ''}`}
              onClick={() => setSidebarOpen((s) => !s)}
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>

            <button type="button" className="lp-model-pill" onClick={focusComposer}>
              <img src="/logo.png" alt="" className="lp-model-pill-logo" />
              <span>DocMind AI</span>
              <ChevronDown size={13} />
            </button>
          </div>

          <div className="lp-topbar-right">
            {isSignedIn ? (
              <div className="lp-profile-pill">
                <UserButton afterSignOutUrl="/" />
              </div>
            ) : (
              <>
                <SignInButton mode="modal" asChild>
                  <button type="button" className="lp-btn lp-btn--ghost">Log in</button>
                </SignInButton>
                <SignUpButton mode="modal" asChild>
                  <button type="button" className="lp-btn lp-btn--solid">Get started</button>
                </SignUpButton>
              </>
            )}
          </div>
        </header>

        {/* ── Stage ────────────────────────────────────────────────── */}
        <main className="lp-stage">

          {/* ── No chat yet: centered hero ────────────────────────── */}
          {!hasChatted && (
            <div className="lp-hero-center">
              <div className="lp-hero-icon">
                <Sparkles size={28} />
              </div>
              <h1 className="lp-heading">
                {isSignedIn ? 'What can I help with?' : 'What do you want to learn today?'}
              </h1>
              {!isSignedIn && (
                <p className="lp-subheading">
                  Ask me anything about how DocMind works — or sign in to start chatting with your own PDFs.
                </p>
              )}
            </div>
          )}

          {/* ── Chat messages ─────────────────────────────────────── */}
          {hasChatted && (
            <div className="lp-chat-scroll">
              <div className="lp-chat-column">
                {messages.map((msg, i) => (
                  msg.role === 'user' ? (
                    <div key={i} className="lp-msg lp-msg--user">
                      <div className="lp-msg-bubble lp-msg-bubble--user">
                        {msg.text}
                      </div>
                      <div className="lp-msg-avatar lp-msg-avatar--user">
                        <User size={15} />
                      </div>
                    </div>
                  ) : (
                    <BotMessage
                      key={i}
                      text={msg.text}
                      isLatest={i === messages.length - 1}
                    />
                  )
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="lp-msg lp-msg--bot">
                    <div className="lp-msg-avatar lp-msg-avatar--bot">
                      <Bot size={16} />
                    </div>
                    <div className="lp-typing-indicator">
                      <span /><span /><span />
                    </div>
                  </div>
                )}

                {/* Sign-in CTA after first bot reply */}
                {!isSignedIn && messages.length >= 2 && (
                  <div className="lp-demo-cta">
                    <p>Ready to try it with your own documents?</p>
                    <div className="lp-demo-cta-btns">
                      <SignInButton mode="modal" asChild>
                        <button type="button" className="lp-btn lp-btn--solid">
                          Sign in to upload a PDF
                        </button>
                      </SignInButton>
                      <SignUpButton mode="modal" asChild>
                        <button type="button" className="lp-btn lp-btn--ghost">
                          Create free account
                        </button>
                      </SignUpButton>
                    </div>
                  </div>
                )}

                <div ref={scrollAnchor} />
              </div>
            </div>
          )}

          {/* ── Suggestion cards (shown until first message) ──────── */}
          {showSuggestions && !hasChatted && (
            <div className="lp-suggestions">
              {SUGGESTIONS.map(({ icon, text }) => (
                <button
                  key={text}
                  type="button"
                  className="lp-suggestion-card"
                  onClick={() => handleSuggestion(text)}
                >
                  <span className="lp-suggestion-icon">{icon}</span>
                  <span className="lp-suggestion-text">{text}</span>
                </button>
              ))}
            </div>
          )}

        </main>

        {/* ── Composer (always pinned at bottom) ───────────────────── */}
        <div className="lp-composer-wrap">
          <form className="lp-composer" onSubmit={handleSubmit}>
            <div className="lp-composer-inner">
              {/* Upload icon — only meaningful after sign in */}
              {isSignedIn ? (
                <button
                  type="button"
                  className="lp-composer-icon"
                  aria-label="Upload document"
                  title="Upload a PDF"
                >
                  <Upload size={19} />
                </button>
              ) : (
                <SignInButton mode="modal" asChild>
                  <button
                    type="button"
                    className="lp-composer-icon"
                    aria-label="Sign in to upload"
                    title="Sign in to upload a PDF"
                  >
                    <Upload size={19} />
                  </button>
                </SignInButton>
              )}

              <textarea
                ref={composerRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isSignedIn
                    ? 'Upload a PDF to start chatting…'
                    : 'Ask me how DocMind works, or anything about the product…'
                }
                rows={1}
                className="lp-composer-textarea"
                disabled={isTyping}
              />

              {/* Mic button */}
              <button
                type="button"
                onClick={handleMicToggle}
                className={`lp-composer-icon lp-mic-btn${listening ? ' is-listening' : ''}`}
                title={listening ? 'Stop recording' : 'Dictate your question'}
                aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              >
                {listening ? <MicOff size={17} /> : <Mic size={17} />}
              </button>

              <button
                type="submit"
                className={`lp-send-btn${(prompt.trim() && !isTyping) ? ' lp-send-btn--active' : ''}`}
                aria-label="Send"
                disabled={isTyping || !prompt.trim()}
              >
                <ArrowUp size={17} />
              </button>
            </div>

            <p className="lp-composer-hint">
              {isSignedIn
                ? 'You\'re signed in — upload a PDF in the workspace to start'
                : 'Ask anything · Sign in to chat with your own documents'}
            </p>
          </form>
        </div>

        {/* Footer */}
        <footer className="lp-footer">
          DocMind AI — answers grounded in your documents, never from general knowledge.
        </footer>
      </div>
    </div>
  )
}
