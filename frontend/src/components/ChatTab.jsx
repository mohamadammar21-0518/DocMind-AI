import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUp, Copy, RefreshCw, Trash2, Download,
  Star, Bot, Info, HelpCircle,
  Mic, MicOff, Volume2, VolumeX, StopCircle,
  ChevronDown, Upload, Sparkles, FileText, User, Plus, Loader2,
} from 'lucide-react'
import { streamChat, uploadPDFs } from '../api'
import { messageAppear } from '../motion'
import { useDictation } from '../hooks/useDictation'
import { useSpeech }    from '../hooks/useSpeech'
import { saveToHistory } from './DocumentHistory'

const DEFAULT_MODEL = 'GPT-OSS 20B (Fast)'
const MAX_FILE_MB = 15

const STARTER_PROMPTS = [
  { text: 'Summarize the key points', icon: '📝' },
  { text: 'Explain the main concepts simply', icon: '💡' },
  { text: 'What are the important takeaways?', icon: '🎯' },
  { text: 'Create a study guide from this doc', icon: '🎓' },
]

export default function ChatTab({
  session,
  chatHistory,
  setChatHistory,
  suggestedQuestions,
  onSuggest,
  loadingSug,
  mobile = false,
  onOpenSidebar,
  onUploaded,
  selectedModel = 'GPT-OSS 20B (Fast)',
}) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const scrollRef = useRef(null)
  const fileInputRef = useRef(null)

  const { listening, supported: micSupported, toggle: toggleMic, pause: pauseMic, resume: resumeMic } = useDictation()
  const { speaking, speakingId, supported: ttsSupported, speak, stop: stopSpeech } = useSpeech()

  const hasMessages = chatHistory.length > 0
  const docName = session.pdf_names?.[0]

  const handleMicToggle = () => {
    if (!micSupported) { toast.error('Your browser does not support voice input'); return }
    toggleMic((text) => setInput(text), input)
    if (!listening) toast('Listening… speak now', { icon: '🎙️', duration: 2000 })
  }

  const handleSpeak = (content, id) => {
    if (!ttsSupported) { toast.error('Your browser does not support text-to-speech'); return }
    speak(content, id, () => { if (listening) pauseMic() }, () => { if (listening) resumeMic() })
  }

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [chatHistory, loading, scrollToBottom])

  useEffect(() => {
    const handleInsightsMsg = (e) => { if (e.detail) sendMessage(e.detail) }
    window.addEventListener('docmind_send_message', handleInsightsMsg)
    return () => window.removeEventListener('docmind_send_message', handleInsightsMsg)
  }, [chatHistory, session])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120)
  }

  const sendMessage = async (question) => {
    if (!question.trim()) return
    stopSpeech()

    const q    = question.trim()
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const newHistory = [...chatHistory, { role: 'user', content: q, time }]
    setChatHistory(newHistory)
    setInput('')

    if (!session.loaded) {
      setTimeout(() => {
        setChatHistory([...newHistory, {
          role: 'bot',
          content: mobile
            ? 'Please **upload a PDF** first — tap the menu (☰) or the upload button below to add your document.'
            : "Please **upload a PDF** first using the sidebar.\n\n1. Choose your AI model\n2. Drop your PDF in the upload zone\n3. Click **Process Document**\n\nThen I can answer questions with page citations.",
          sources: [],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }])
      }, 400)
      return
    }

    setLoading(true)
    try {
      const botMsgIndex = newHistory.length
      setChatHistory([...newHistory, {
        role: 'bot', content: '', sources: [],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        streaming: true,
      }])

      let fullText = ''
      let sources  = []
      let backendConfidence = null

      streamChat(
        { question: q, chat_history: chatHistory },
        (token) => {
          fullText += token
          setChatHistory(prev => {
            const u = [...prev]
            u[botMsgIndex] = { ...u[botMsgIndex], content: fullText }
            return u
          })
        },
        (srcs, confidence) => {
          sources = srcs
          backendConfidence = typeof confidence === 'number' ? confidence : null
        },
        () => {
          setChatHistory(prev => {
            const u = [...prev]
            u[botMsgIndex] = {
              ...u[botMsgIndex], sources, streaming: false,
              confidence: backendConfidence ?? Math.min(5, Math.max(1, sources.length + 1)),
            }
            return u
          })
          setLoading(false)
          setTimeout(() => inputRef.current?.focus(), 100)
        },
        (err) => {
          setChatHistory(prev => {
            const u = [...prev]
            u[botMsgIndex] = { role: 'bot', content: `⚠️ ${err}`, sources: [], streaming: false, time: '' }
            return u
          })
          setLoading(false)
        }
      )
    } catch (e) {
      setChatHistory([...chatHistory, { role: 'bot', content: `⚠️ ${e.message}`, sources: [], time: '' }])
      setLoading(false)
    }
  }

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content)
    toast.success('Copied')
  }

  const handleRegenerate = (question) => {
    stopSpeech()
    setChatHistory(chatHistory.slice(0, -2))
    sendMessage(question)
  }

  const exportChat = () => {
    const text = chatHistory.map(m => `${m.role === 'user' ? 'You' : 'DocMind'}:\n${m.content}`).join('\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `docmind_chat_${Date.now()}.txt`
    a.click()
  }

  const handleComposerResize = (el) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, mobile ? 120 : 200)}px`
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handlePlusClick = () => {
    if (uploading) return
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e) => {
    const picked = Array.from(e.target.files || [])
    e.target.value = ''
    if (!picked.length) return

    const invalid = picked.find(f => f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf'))
    if (invalid) {
      toast.error('Please select PDF files only')
      return
    }

    const tooLarge = picked.find(f => f.size > MAX_FILE_MB * 1024 * 1024)
    if (tooLarge) {
      toast.error(`Each PDF must be under ${MAX_FILE_MB}MB`)
      return
    }

    setUploading(true)
    const toastId = toast.loading(
      picked.length === 1
        ? `Processing "${picked[0].name}"…`
        : `Processing ${picked.length} PDFs…`
    )

    const fd = new FormData()
    picked.forEach(f => fd.append('files', f))
    fd.append('groq_api_key', '')
    fd.append('model_label', selectedModel)
    fd.append('chunk_size', '1000')
    fd.append('chunk_overlap', '200')

    try {
      const res = await uploadPDFs(fd)
      toast.success(res.data.message, { id: toastId })
      saveToHistory(res.data.pdf_names, res.data.num_pages, res.data.num_chunks)
      onUploaded?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed', { id: toastId })
    } finally {
      setUploading(false)
    }
  }

  const displayPrompts = suggestedQuestions?.length > 0
    ? suggestedQuestions.slice(0, 4).map(q => ({ text: q, icon: '✦' }))
    : STARTER_PROMPTS

  return (
    <div className={`chat-tab${mobile ? ' chat-tab--mobile' : ''}`}>

      {/* ── Slim header (ChatGPT-style doc pill + actions) ─────── */}
      <header className="chat-header">
        <div className="chat-header-left">
          <button
            type="button"
            className={`chat-doc-pill${session.loaded ? ' chat-doc-pill--live' : ''}`}
            onClick={!session.loaded ? onOpenSidebar : undefined}
            title={session.loaded ? docName : 'Upload a document'}
          >
            <span className={`chat-doc-dot ${session.loaded ? 'is-ready' : 'is-idle'}`} />
            <span className="chat-doc-label">
              {session.loaded
                ? (docName || 'Document ready')
                : 'No document loaded'}
            </span>
            {session.loaded && (
              <span className="chat-doc-meta">
                {session.num_pages}p · {session.num_chunks} chunks
              </span>
            )}
            {!session.loaded && <ChevronDown size={13} className="chat-doc-chevron" />}
          </button>
        </div>

        <div className="chat-header-actions">
          {speaking && (
            <button type="button" onClick={stopSpeech} className="chat-header-btn" title="Stop reading" aria-label="Stop reading">
              <StopCircle size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onSuggest}
            disabled={loadingSug || !session.loaded}
            className="chat-header-btn"
            title="Suggest questions"
            aria-label="Suggest questions"
          >
            <HelpCircle size={16} />
          </button>
          {hasMessages && (
            <>
              <button type="button" onClick={exportChat} className="chat-header-btn" title="Export chat" aria-label="Export chat">
                <Download size={16} />
              </button>
              <button
                type="button"
                onClick={() => { stopSpeech(); setChatHistory([]) }}
                className="chat-header-btn chat-header-btn--danger"
                title="New chat"
                aria-label="New chat"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Stage ──────────────────────────────────────────────── */}
      <main className="chat-stage">

        {/* Empty state — centered hero + suggestions */}
        {!hasMessages && (
          <>
            <div className="chat-hero">
              <div className="chat-hero-icon">
                {session.loaded ? <Sparkles size={26} /> : <FileText size={26} />}
              </div>
              <h2 className="chat-hero-title">
                {session.loaded ? 'What can I help with?' : 'Chat with your PDF'}
              </h2>
              <p className="chat-hero-subtitle">
                {session.loaded
                  ? 'Ask questions, get summaries, or explore your document.'
                  : mobile
                    ? 'Upload a PDF from the menu to get started.'
                    : 'Upload a PDF from the sidebar, then ask anything about it.'}
              </p>
            </div>

            <div className="chat-starters">
              {displayPrompts.map(({ text, icon }) => (
                <button
                  key={text}
                  type="button"
                  className="chat-starter-card"
                  onClick={() => {
                    if (!session.loaded) { onOpenSidebar?.(); return }
                    sendMessage(text)
                  }}
                >
                  <span className="chat-starter-icon">{icon}</span>
                  <span className="chat-starter-text">{text}</span>
                </button>
              ))}
            </div>

            {!session.loaded && (
              <button type="button" className="chat-upload-cta" onClick={onOpenSidebar}>
                <Upload size={16} />
                Upload a PDF to begin
              </button>
            )}
          </>
        )}

        {/* Message thread */}
        {hasMessages && (
          <div className="chat-scroll" ref={scrollRef} onScroll={handleScroll}>
            <div className="chat-thread">
              {chatHistory.map((msg, i) => {
                const isUser    = msg.role === 'user'
                const isPlaying = speakingId === i

                if (isUser) {
                  return (
                    <motion.div
                      key={i}
                      variants={messageAppear}
                      initial="hidden"
                      animate="visible"
                      className="chat-turn chat-turn--user"
                    >
                      <div className="chat-turn-content">
                        <div className="chat-bubble chat-bubble--user">{msg.content}</div>
                      </div>
                      <div className="chat-turn-avatar chat-turn-avatar--user">
                        <User size={15} />
                      </div>
                    </motion.div>
                  )
                }

                return (
                  <motion.div
                    key={i}
                    variants={messageAppear}
                    initial="hidden"
                    animate="visible"
                    className="chat-turn chat-turn--assistant"
                  >
                    <div className="chat-turn-avatar chat-turn-avatar--bot">
                      <Bot size={16} />
                    </div>
                    <div className="chat-turn-content">
                      <div className="chat-bubble chat-bubble--assistant">
                        <div className="markdown chat-markdown">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>

                      {!msg.streaming && msg.content && (
                        <div className="chat-turn-footer">
                          {msg.confidence && (
                            <span className={`chat-confidence chat-confidence--${msg.confidence >= 4 ? 'high' : msg.confidence >= 3 ? 'mid' : 'low'}`}>
                              <Star size={9} fill="currentColor" /> {msg.confidence}/5
                            </span>
                          )}
                          <div className="chat-turn-actions">
                            <button type="button" onClick={() => handleCopy(msg.content)} className="chat-action-btn" title="Copy" aria-label="Copy">
                              <Copy size={13} />
                            </button>
                            {i > 0 && chatHistory[i - 1]?.role === 'user' && (
                              <button
                                type="button"
                                onClick={() => handleRegenerate(chatHistory[i - 1].content)}
                                className="chat-action-btn"
                                title="Regenerate"
                                aria-label="Regenerate"
                              >
                                <RefreshCw size={13} />
                              </button>
                            )}
                            {ttsSupported && (
                              <button
                                type="button"
                                onClick={() => handleSpeak(msg.content, i)}
                                className={`chat-action-btn${isPlaying ? ' is-active' : ''}`}
                                title={isPlaying ? 'Stop' : 'Read aloud'}
                                aria-label={isPlaying ? 'Stop reading' : 'Read aloud'}
                              >
                                {isPlaying ? <VolumeX size={13} /> : <Volume2 size={13} />}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {msg.sources?.length > 0 && (
                        <div className="chat-sources">
                          <div className="chat-sources-label"><Info size={11} /> Sources</div>
                          {msg.sources.map((s, idx) => (
                            <div key={idx} className="chat-source-card">
                              <div className="chat-source-header">
                                <span className="citation-chip">
                                  Page {s.page}{s.source_file ? ` · ${s.source_file}` : ''}
                                </span>
                                {typeof s.score === 'number' && (
                                  <span className="chat-source-score">
                                    {(s.score * 10).toFixed(0)}/10 match
                                  </span>
                                )}
                              </div>
                              <p className="chat-source-snippet">"{s.snippet}…"</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}

              {loading && (
                <div className="chat-turn chat-turn--assistant">
                  <div className="chat-turn-avatar chat-turn-avatar--bot">
                    <Bot size={16} />
                  </div>
                  <div className="chat-typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}

              <div ref={bottomRef} className="chat-scroll-anchor" />
            </div>

            <AnimatePresence>
              {showScrollBtn && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="chat-scroll-fab"
                  onClick={() => scrollToBottom()}
                  aria-label="Scroll to bottom"
                >
                  <ChevronDown size={18} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* ── Composer (pinned bottom, ChatGPT-style) ────────────── */}
      <div className="chat-composer-wrap">
        <form className="chat-composer" onSubmit={handleSubmit}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="chat-file-input"
            onChange={handleFileSelect}
            aria-hidden="true"
            tabIndex={-1}
          />

          <div className="chat-composer-box">
            <button
              type="button"
              className={`chat-composer-icon-btn chat-composer-add${uploading ? ' is-uploading' : ''}`}
              onClick={handlePlusClick}
              disabled={uploading}
              aria-label="Upload PDF"
              title={uploading ? 'Processing PDF…' : 'Upload PDF'}
            >
              {uploading ? <Loader2 size={18} className="chat-spinner" /> : <Plus size={18} strokeWidth={2.25} />}
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onInput={e => handleComposerResize(e.currentTarget)}
              onFocus={e => handleComposerResize(e.currentTarget)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
              }}
              placeholder={
                uploading
                  ? 'Processing your document…'
                  : session.loaded
                    ? 'Message DocMind…'
                    : 'Upload a PDF to start chatting…'
              }
              className="chat-composer-textarea"
              rows={1}
              disabled={uploading}
            />

            <button
              type="button"
              onClick={handleMicToggle}
              disabled={uploading}
              className={`chat-composer-icon-btn${listening ? ' is-recording' : ''}`}
              title={listening ? 'Stop dictation' : 'Dictate'}
              aria-label={listening ? 'Stop dictation' : 'Dictate'}
            >
              {listening ? <MicOff size={17} /> : <Mic size={17} />}
            </button>

            <button
              type="submit"
              disabled={loading || uploading || !input.trim()}
              className={`chat-composer-send${input.trim() && !loading && !uploading ? ' is-ready' : ''}`}
              aria-label="Send message"
            >
              <ArrowUp size={17} />
            </button>
          </div>

          <p className="chat-composer-disclaimer">
            DocMind answers from your document. Verify important details against the source.
          </p>
        </form>
      </div>
    </div>
  )
}
