import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  Send, Copy, RefreshCw, Trash2, Download,
  Star, Brain, Info, HelpCircle,
  Mic, MicOff, Volume2, VolumeX, StopCircle,
} from 'lucide-react'
import { streamChat } from '../api'
import { messageAppear } from '../motion'
import { useDictation } from '../hooks/useDictation'
import { useSpeech }    from '../hooks/useSpeech'

export default function ChatTab({ session, chatHistory, setChatHistory, suggestedQuestions, onSuggest, loadingSug }) {
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // ── Voice input (dictation) ───────────────────────────────────
  const { listening, supported: micSupported, toggle: toggleMic, pause: pauseMic, resume: resumeMic } = useDictation()

  const handleMicToggle = () => {
    if (!micSupported) { toast.error('Your browser does not support voice input'); return }
    toggleMic((text) => setInput(text), input)
    if (!listening) toast('Listening… speak now', { icon: '🎙️', duration: 2000 })
  }

  // ── Voice output (TTS) ────────────────────────────────────────
  const { speaking, speakingId, supported: ttsSupported, speak, stop: stopSpeech } = useSpeech()

  const handleSpeak = (content, id) => {
    if (!ttsSupported) { toast.error('Your browser does not support text-to-speech'); return }
    speak(
      content,
      id,
      () => { if (listening) pauseMic() },    // onBefore — mute mic while TTS plays
      () => { if (listening) resumeMic() }    // onAfter  — restore mic when TTS finishes
    )
  }

  // ── Quick prompts ─────────────────────────────────────────────
  const quickPrompts = session.loaded
    ? [
        'Summarize the document in 5 bullet points',
        'What are the key arguments and evidence?',
        'Explain the hardest concept in simple terms',
        'Create a short study guide from this PDF',
      ]
    : [
        'Upload a PDF to start chatting',
        'Ask for summaries, study notes, or Q&A',
        'Use the sidebar to choose your model',
      ]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, loading])

  useEffect(() => {
    const handleInsightsMsg = (e) => { if (e.detail) sendMessage(e.detail) }
    window.addEventListener('docmind_send_message', handleInsightsMsg)
    return () => window.removeEventListener('docmind_send_message', handleInsightsMsg)
  }, [chatHistory, session])

  // ── Send / stream ─────────────────────────────────────────────
  const sendMessage = async (question) => {
    if (!question.trim()) return
    // Stop any playing TTS when a new message is sent
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
          content: "I'd love to help! 😊 Please **upload a PDF document** first using the sidebar on the left.\n\n**Steps to get started:**\n1. Select an AI model of choice.\n2. Drag & drop a PDF file inside the upload zone.\n3. Click **⚡ Process Document** to start indexing.\n\nOnce the database finishes embedding, I can answer queries with source references!",
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
    toast.success('Copied to clipboard')
  }

  const handleRegenerate = (question) => {
    stopSpeech()
    const updated = chatHistory.slice(0, -2)
    setChatHistory(updated)
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
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="chat-tab" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="chat-toolbar">
        <div className="chat-toolbar-left">
          <div className="chat-conversation-chip">
            <span className={`chat-conversation-dot ${session.loaded ? 'is-ready' : 'is-idle'}`} />
            <span>{session.loaded ? 'Document chat ready' : 'Waiting for a PDF'}</span>
          </div>
          {session.loaded && (
            <div className="chat-meta">
              {session.num_pages} pages · {session.num_chunks} chunks
            </div>
          )}
          {/* Global TTS stop button — only when playing */}
          {speaking && (
            <button
              onClick={stopSpeech}
              className="btn-subtle chat-toolbar-button tts-stop-btn"
              title="Stop reading aloud"
            >
              <StopCircle size={12} /> Stop reading
            </button>
          )}
        </div>
        <div className="chat-toolbar-actions">
          <button onClick={onSuggest} disabled={loadingSug || !session.loaded} className="btn-subtle chat-toolbar-button">
            <HelpCircle size={12} /> Suggest
          </button>
          {chatHistory.length > 0 && (
            <>
              <button onClick={exportChat} className="btn-subtle chat-toolbar-button">
                <Download size={12} /> Export
              </button>
              <button onClick={() => { stopSpeech(); setChatHistory([]) }} className="btn-danger chat-toolbar-button">
                <Trash2 size={12} /> New chat
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Recommended pills ────────────────────────────────── */}
      {suggestedQuestions?.length > 0 && (
        <div className="chat-recommendations">
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', alignSelf: 'center', marginRight: '0.2rem' }}>Recommended:</span>
          {suggestedQuestions.slice(0, 3).map((q, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(q)}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: '16px', padding: '0.2rem 0.75rem',
                fontSize: '0.72rem', color: 'var(--accent)', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-muted)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)' }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────── */}
      <div className="chat-scroll">
        <div className="chat-column">
          {chatHistory.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">🧠</div>
              <h3 className="panel-heading chat-empty-title">
                {session.loaded ? 'Start a conversation' : 'Upload a document to begin'}
              </h3>
              <p className="chat-empty-copy">
                {session.loaded
                  ? 'Ask for a summary, a simpler explanation, key points, or a study guide.'
                  : 'Add a PDF from the left panel, then come back here to chat with it like ChatGPT.'}
              </p>
              <div className="prompt-grid">
                {quickPrompts.map(q => (
                  <button
                    key={q}
                    onClick={() => session.loaded && sendMessage(q)}
                    className="prompt-card"
                    disabled={!session.loaded && q !== 'Upload a PDF to start chatting'}
                  >
                    <span>{q}</span>
                    <span>↗</span>
                  </button>
                ))}
              </div>
              {session.loaded && (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['Summarize the document', 'What are the key terms?', 'What is the main topic?'].map(q => (
                    <button key={q} onClick={() => sendMessage(q)} className="btn-subtle pill-button" style={{ padding: '0.35rem 0.8rem', fontSize: '0.74rem' }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {chatHistory.map((msg, i) => {
                const isUser   = msg.role === 'user'
                const isPlaying = speakingId === i

                return (
                  <motion.div
                    key={i}
                    variants={messageAppear}
                    initial="hidden"
                    animate="visible"
                    className={`chat-message ${isUser ? 'chat-message-user' : ''}`}
                  >
                    {!isUser && (
                      <div className="chat-avatar">
                        <Brain size={14} color="white" />
                      </div>
                    )}

                    <div style={{ maxWidth: '80%' }}>
                      <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
                        {isUser ? msg.content : (
                          <div className="markdown">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {/* Meta row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', justifyContent: isUser ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.64rem', color: 'var(--text-tertiary)' }}>{msg.time}</span>

                        {!isUser && msg.confidence && (
                          <span style={{ fontSize: '0.64rem', color: msg.confidence >= 4 ? 'var(--success)' : msg.confidence >= 3 ? 'var(--warning)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                            <Star size={8} fill="currentColor" /> {msg.confidence}/5
                          </span>
                        )}

                        {!isUser && !msg.streaming && msg.content && (
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            {/* Copy */}
                            <button
                              onClick={() => handleCopy(msg.content)}
                              className="msg-action-btn"
                              title="Copy response"
                            >
                              <Copy size={10} />
                            </button>

                            {/* Regenerate */}
                            {i > 0 && chatHistory[i - 1]?.role === 'user' && (
                              <button
                                onClick={() => handleRegenerate(chatHistory[i - 1].content)}
                                className="msg-action-btn"
                                title="Regenerate response"
                              >
                                <RefreshCw size={10} />
                              </button>
                            )}

                            {/* ── Speak / Stop reading ── */}
                            {ttsSupported && (
                              <button
                                onClick={() => handleSpeak(msg.content, i)}
                                className={`msg-action-btn msg-speak-btn${isPlaying ? ' is-speaking' : ''}`}
                                title={isPlaying ? 'Stop reading' : 'Read aloud'}
                              >
                                {isPlaying ? <VolumeX size={10} /> : <Volume2 size={10} />}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Sources */}
                      {!isUser && msg.sources?.length > 0 && (
                        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ fontSize: '0.64rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Info size={10} /> Reference Sources:
                          </div>
                          {msg.sources.map((s, idx) => (
                            <div key={idx} className="source-card" style={{ fontSize: '0.74rem' }}>
                              <div style={{ marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="citation-chip" style={{ fontSize: '0.62rem' }}>
                                  Page {s.page}{s.source_file ? ` · ${s.source_file}` : ''}
                                </span>
                                {typeof s.score === 'number' && (
                                  <span style={{ fontSize: '0.6rem', color: 'var(--success)', background: 'var(--success-muted)', padding: '0.05rem 0.3rem', borderRadius: '4px', fontWeight: 600 }}>
                                    Match: {(s.score * 10).toFixed(0)}/10
                                  </span>
                                )}
                              </div>
                              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic' }}>
                                "{s.snippet}..."
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}

              {/* Typing indicator */}
              {loading && (
                <div className="chat-message" style={{ marginBottom: '1.2rem' }}>
                  <div className="chat-avatar"><Brain size={14} color="white" /></div>
                  <div className="typing-indicator">
                    {[0, 1, 2].map(idx => (
                      <div key={idx} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', animation: `bounce-dot 1.2s ease-in-out ${idx * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Composer ─────────────────────────────────────────── */}
      <div className="chat-composer">
        <div className="chat-composer-shell">
          <div className="chat-composer-inner">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onInput={e => handleComposerResize(e.currentTarget)}
              onFocus={e => handleComposerResize(e.currentTarget)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
              }}
              placeholder={session.loaded ? 'Ask anything about this document...' : 'Upload a PDF to begin chatting...'}
              className="chat-composer-input chat-composer-textarea"
              rows={1}
            />

            {/* Mic / dictation */}
            <button
              type="button"
              onClick={handleMicToggle}
              className={`chat-composer-mic${listening ? ' is-listening' : ''}`}
              title={listening ? 'Stop dictation' : 'Dictate a question'}
            >
              {listening ? <MicOff size={13} /> : <Mic size={13} />}
            </button>

            {/* Send */}
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="chat-composer-send"
              style={{
                background: input.trim() && !loading ? 'var(--gradient)' : 'var(--bg-glass)',
                color: 'white',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              <Send size={12} />
            </button>
          </div>

          <div className="chat-composer-hint">
            <span>Enter to send · Shift+Enter for new line</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.64rem' }}>
              {micSupported && (
                <span style={{ color: listening ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {listening ? '🔴 Recording…' : '🎙️ Voice input'}
                </span>
              )}
              {ttsSupported && speaking && (
                <span style={{ color: 'var(--accent)' }}>🔊 Reading aloud…</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
