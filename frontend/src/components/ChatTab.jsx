import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { sendChat, streamChat, getSuggestedQuestions } from '../api'

export default function ChatTab({ session, chatHistory, setChatHistory }) {
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [suggested,  setSuggested]  = useState([])
  const [loadingSug, setLoadingSug] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatHistory, loading])

  const sendMessage = async (question) => {
    if (!question.trim()) return
    const q = question.trim()
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const newHistory = [...chatHistory, { role: 'user', content: q, time }]
    setChatHistory(newHistory)
    setInput('')

    // If no document loaded, reply with a helpful message instead of blocking
    if (!session.loaded) {
      setTimeout(() => {
        setChatHistory([...newHistory, {
          role: 'bot',
          content: "I'd love to help! 😊 Please **upload a PDF document** first using the sidebar on the left.\n\n**Steps to get started:**\n1. Enter your Groq API key\n2. Drag & drop a PDF file\n3. Click **⚡ Process Documents**\n\nOnce your document is indexed, I can answer any questions about it!",
          sources: [],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }])
      }, 400)
      return
    }

    setLoading(true)
    try {
      // Add empty bot message that will be filled by streaming
      const botMsgIndex = newHistory.length
      setChatHistory([...newHistory, { role: 'bot', content: '', sources: [], time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), streaming: true }])

      let fullText = ''
      let sources  = []

      const cancel = streamChat(
        { question: q, chat_history: chatHistory },
        (token) => {
          fullText += token
          setChatHistory(prev => {
            const updated = [...prev]
            updated[botMsgIndex] = { ...updated[botMsgIndex], content: fullText }
            return updated
          })
        },
        (srcs) => { sources = srcs },
        () => {
          // Done
          setChatHistory(prev => {
            const updated = [...prev]
            updated[botMsgIndex] = { ...updated[botMsgIndex], sources, streaming: false }
            return updated
          })
          setLoading(false)
          setTimeout(() => inputRef.current?.focus(), 100)
        },
        (err) => {
          setChatHistory(prev => {
            const updated = [...prev]
            updated[botMsgIndex] = { role: 'bot', content: `⚠️ ${err}`, sources: [], streaming: false, time: '' }
            return updated
          })
          setLoading(false)
        }
      )
    } catch (e) {
      setChatHistory([...newHistory, { role: 'bot', content: `⚠️ ${e.message}`, sources: [], time: '' }])
      setLoading(false)
    }
  }

  const handleSuggest = async () => {
    if (!session.loaded) return toast.error('Upload a document first')
    setLoadingSug(true)
    try { const r = await getSuggestedQuestions(); setSuggested(r.data.questions) }
    catch { toast.error('Could not generate questions') }
    finally { setLoadingSug(false) }
  }

  const exportChat = () => {
    const text = chatHistory.map(m => `${m.role === 'user' ? 'You' : 'DocMind'}:\n${m.content}`).join('\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `docmind_${Date.now()}.txt`; a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{ padding: '0.6rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0, background: 'rgba(13,13,26,0.5)' }}>
        <GhostBtn onClick={handleSuggest} loading={loadingSug}>
          {loadingSug ? <Spinner /> : '💡'} Suggest Questions
        </GhostBtn>
        {chatHistory.length > 0 && <GhostBtn onClick={exportChat}>💾 Export</GhostBtn>}
        {chatHistory.length > 0 && <GhostBtn onClick={() => { setChatHistory([]); setSuggested([]) }} danger>🗑️ Clear</GhostBtn>}
        <div style={{ flex: 1 }} />
        {session.loaded && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#43e97b' }} />
            {session.num_chunks} chunks indexed
          </div>
        )}
      </div>

      {/* Suggested pills */}
      {suggested.length > 0 && (
        <div style={{ padding: '0.6rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', flexShrink: 0, background: 'rgba(102,126,234,0.03)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '0.2rem' }}>Try:</span>
          {suggested.map((q, i) => (
            <button key={i} onClick={() => sendMessage(q)} style={{
              background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.25)',
              color: 'var(--accent)', borderRadius: '20px', padding: '0.25rem 0.9rem',
              fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Inter,sans-serif',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(102,126,234,0.15)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(102,126,234,0.08)'; e.currentTarget.style.borderColor = 'rgba(102,126,234,0.25)' }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 1.5rem' }}>
        {chatHistory.length === 0 ? (
          <EmptyState loaded={session.loaded} />
        ) : (
          <>
            {chatHistory.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'rgba(13,13,26,0.8)', backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '16px', padding: '0.6rem 0.6rem 0.6rem 1rem', transition: 'border-color 0.3s' }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
            placeholder={session.loaded ? 'Ask anything about your document...' : 'Ask me anything — or upload a PDF to get started...'}
            disabled={false}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.92rem', outline: 'none', fontFamily: 'Inter,sans-serif', resize: 'none', lineHeight: 1.5 }} />
          <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
            className="btn-primary" style={{ padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '1rem', flexShrink: 0 }}>
            {loading ? <Spinner /> : '➤'}
          </button>
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
          Press Enter to send · Powered by Groq Llama 3
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ msg }) {
  const [showSources, setShowSources] = useState(false)
  const isUser = msg.role === 'user'

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '1.5rem', alignItems: 'flex-end', gap: '0.7rem', animation: 'fadeInUp 0.3s ease' }}>
      {!isUser && (
        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0, boxShadow: '0 4px 12px rgba(102,126,234,0.3)' }}>🧠</div>
      )}
      <div style={{ maxWidth: '72%' }}>
        <div style={{
          background: isUser ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'var(--bg-card)',
          color: 'var(--text-primary)',
          padding: '0.85rem 1.2rem',
          borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
          border: isUser ? 'none' : '1px solid var(--border)',
          fontSize: '0.9rem', lineHeight: 1.7,
          boxShadow: isUser ? '0 4px 20px rgba(102,126,234,0.25)' : '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          {isUser ? msg.content : <div className="markdown"><ReactMarkdown>{msg.content}</ReactMarkdown></div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.3rem', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{msg.time}</span>
          {msg.sources?.length > 0 && (
            <button onClick={() => setShowSources(!showSources)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.72rem', cursor: 'pointer', padding: 0, fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: showSources ? 'rotate(90deg)' : '' }}>▶</span>
              {msg.sources.length} source{msg.sources.length > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {showSources && msg.sources?.length > 0 && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', animation: 'fadeInUp 0.2s ease' }}>
            {msg.sources.map((s, i) => (
              <div key={i} style={{ background: 'rgba(102,126,234,0.06)', border: '1px solid rgba(102,126,234,0.15)', borderLeft: '3px solid var(--accent)', borderRadius: '0 10px 10px 0', padding: '0.7rem 0.9rem', fontSize: '0.78rem' }}>
                <div style={{ marginBottom: '0.4rem' }}>
                  <span style={{ background: 'rgba(102,126,234,0.15)', color: 'var(--accent)', borderRadius: '12px', padding: '0.15rem 0.6rem', fontSize: '0.7rem', fontWeight: 600 }}>
                    Page {s.page}{s.source_file ? ` · ${s.source_file}` : ''}
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.snippet}...</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ loaded }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', textAlign: 'center', padding: '2rem' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'float 3s ease-in-out infinite' }}>🧠</div>
      <h3 style={{ fontFamily: 'Space Grotesk', fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
        {loaded ? 'Ready to answer your questions' : 'No document loaded'}
      </h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '380px', lineHeight: 1.6 }}>
        {loaded ? 'Ask anything about your document. Try the 💡 Suggest Questions button for ideas.' : 'Upload a PDF in the sidebar to start chatting with your document.'}
      </p>
      {loaded && (
        <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {['What is this document about?', 'Summarize the key points', 'What are the main conclusions?'].map(q => (
            <div key={q} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '20px', padding: '0.4rem 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{q}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.7rem', marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>🧠</div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px 20px 20px 4px', padding: '0.85rem 1.2rem', display: 'flex', gap: '5px', alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', animation: `bounce-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  )
}

function GhostBtn({ children, onClick, loading, danger }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      background: 'var(--bg-glass)', border: `1px solid ${danger ? 'rgba(245,87,108,0.3)' : 'var(--border)'}`,
      color: danger ? 'var(--danger)' : 'var(--text-secondary)',
      borderRadius: '8px', padding: '0.35rem 0.8rem', fontSize: '0.78rem',
      cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif',
      display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.2s',
      opacity: loading ? 0.6 : 1,
    }}
      onMouseEnter={e => { if (!loading) e.currentTarget.style.borderColor = danger ? 'var(--danger)' : 'var(--border-accent)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = danger ? 'rgba(245,87,108,0.3)' : 'var(--border)' }}>
      {children}
    </button>
  )
}

function Spinner() {
  return <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
}
