import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import LandingPage from './components/LandingPage'
import Sidebar from './components/Sidebar'
import ChatTab from './components/ChatTab'
import SummaryTab from './components/SummaryTab'
import StudyNotesTab from './components/StudyNotesTab'
import EvaluationTab from './components/EvaluationTab'
import { getSession } from './api'

const TABS = [
  { id: 'chat',    label: '💬', full: 'Chat' },
  { id: 'summary', label: '📝', full: 'Summary' },
  { id: 'notes',   label: '🎓', full: 'Study Notes' },
  { id: 'eval',    label: '📊', full: 'Evaluation' },
]

export default function App() {
  const [page,         setPage]         = useState('landing')
  const [activeTab,    setActiveTab]    = useState('chat')
  const [session,      setSession]      = useState({ loaded: false, pdf_names: [], num_pages: 0, num_chunks: 0 })
  const [chatHistory,  setChatHistory]  = useState([])
  const [sidebarOpen,  setSidebarOpen]  = useState(true)

  const refreshSession = async () => {
    try { const r = await getSession(); setSession(r.data) } catch {}
  }

  useEffect(() => { refreshSession() }, [])

  if (page === 'landing') {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ style: { background: '#12122a', color: '#f0f4ff', border: '1px solid rgba(255,255,255,0.08)' } }} />
        <LandingPage onEnter={() => setPage('app')} />
      </>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <Toaster position="top-right" toastOptions={{ style: { background: '#12122a', color: '#f0f4ff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' } }} />

      {/* Sidebar */}
      <div style={{ width: sidebarOpen ? '300px' : '0', flexShrink: 0, transition: 'width 0.3s ease', overflow: 'hidden' }}>
        <Sidebar session={session} onUploaded={() => { refreshSession(); setChatHistory([]) }} />
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{
          height: '60px', flexShrink: 0,
          background: 'rgba(13,13,26,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 1.5rem', gap: '1rem',
        }}>
          {/* Sidebar toggle */}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border)',
            borderRadius: '8px', width: '34px', height: '34px',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', flexShrink: 0,
          }}>☰</button>

          {/* Logo */}
          <button onClick={() => { setPage('landing'); window.scrollTo(0,0) }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0,
          }}>
            <span style={{ fontSize: '1.2rem' }}>🧠</span>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: '1rem', background: 'linear-gradient(135deg,#667eea,#f093fb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>DocMind AI</span>
          </button>

          {/* Back to home */}
          <button onClick={() => { setPage('landing'); window.scrollTo(0,0) }} style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '0.3rem 0.8rem',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem',
            fontFamily: 'Inter,sans-serif', transition: 'all 0.2s', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: '0.3rem',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-accent)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
            ← Home
          </button>

          {/* Status */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {session.loaded ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#43e97b', boxShadow: '0 0 6px #43e97b', flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {session.pdf_names.join(', ')} · {session.num_pages} pages · {session.num_chunks} chunks
                </span>
              </div>
            ) : (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>○ No document loaded — upload a PDF to begin</span>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                background: activeTab === t.id ? 'rgba(102,126,234,0.12)' : 'transparent',
                color: activeTab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: `2px solid ${activeTab === t.id ? 'var(--accent)' : 'transparent'}`,
                padding: '0.4rem 0.9rem', cursor: 'pointer',
                fontSize: '0.82rem', fontWeight: activeTab === t.id ? 600 : 400,
                transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
                borderRadius: '8px 8px 0 0', whiteSpace: 'nowrap',
              }}>
                {t.label} {t.full}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', animation: 'fadeIn 0.3s ease' }}>
          {activeTab === 'chat'    && <ChatTab session={session} chatHistory={chatHistory} setChatHistory={setChatHistory} />}
          {activeTab === 'summary' && <SummaryTab session={session} />}
          {activeTab === 'notes'   && <StudyNotesTab session={session} />}
          {activeTab === 'eval'    && <EvaluationTab session={session} />}
        </div>
      </div>
    </div>
  )
}
