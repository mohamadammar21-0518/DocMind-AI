import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { MessageSquare, FileText, BookOpen, BarChart2 } from 'lucide-react'
import LandingPage from './components/LandingPage'
import Sidebar from './components/Sidebar'
import ChatTab from './components/ChatTab'
import SummaryTab from './components/SummaryTab'
import StudyNotesTab from './components/StudyNotesTab'
import EvaluationTab from './components/EvaluationTab'
import { getSession } from './api'

const TABS = [
  { id: 'chat',    Icon: MessageSquare, full: 'Chat' },
  { id: 'summary', Icon: FileText,      full: 'Summary' },
  { id: 'notes',   Icon: BookOpen,      full: 'Study Notes' },
  { id: 'eval',    Icon: BarChart2,     full: 'Evaluation' },
]

const isMobile = () => window.innerWidth <= 768

export default function App() {
  const [page,         setPage]         = useState('landing')
  const [activeTab,    setActiveTab]    = useState('chat')
  const [session,      setSession]      = useState({ loaded: false, pdf_names: [], num_pages: 0, num_chunks: 0 })
  const [chatHistory,  setChatHistory]  = useState([])
  const [sidebarOpen,  setSidebarOpen]  = useState(!isMobile())
  const [mobile,       setMobile]       = useState(isMobile())

  const refreshSession = async () => {
    try { const r = await getSession(); setSession(r.data) } catch {}
  }

  useEffect(() => { refreshSession() }, [])

  useEffect(() => {
    const handleResize = () => {
      const m = isMobile()
      setMobile(m)
      if (!m) setSidebarOpen(true)
      else setSidebarOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (page === 'landing') {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ style: { background: '#12122a', color: '#f0f4ff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' } }} />
        <LandingPage onEnter={() => setPage('app')} />
      </>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <Toaster position="top-right" toastOptions={{ style: { background: '#12122a', color: '#f0f4ff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' } }} />

      {/* Mobile backdrop */}
      {mobile && sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div style={{
        width: '300px', flexShrink: 0,
        transition: 'transform 0.3s ease',
        ...(mobile ? {
          position: 'fixed', top: 0, left: 0, bottom: 0,
          zIndex: 200, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: sidebarOpen ? '4px 0 30px rgba(0,0,0,0.5)' : 'none',
        } : {
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          marginLeft: sidebarOpen ? '0' : '-300px',
        })
      }}>
        <Sidebar session={session} onUploaded={() => {
          refreshSession()
          setChatHistory([])
          if (mobile) setSidebarOpen(false)
        }} />
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{
          height: '56px', flexShrink: 0,
          background: 'rgba(13,13,26,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 1rem', gap: '0.6rem',
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
            <img src="/logo.png" alt="DocMind AI" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '6px' }} />
            <span className="topbar-logo-text" style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: '1rem', background: 'linear-gradient(135deg,#667eea,#f093fb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>DocMind AI</span>
          </button>

          {/* Back to home */}
          <button className="topbar-back" onClick={() => { setPage('landing'); window.scrollTo(0,0) }} style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '0.3rem 0.8rem',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem',
            fontFamily: 'Inter,sans-serif', transition: 'all 0.2s', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: '0.3rem',
          }}>← Home</button>

          {/* Status */}
          <div className="topbar-status" style={{ flex: 1, minWidth: 0 }}>
            {session.loaded ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#43e97b', boxShadow: '0 0 6px #43e97b', flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {session.pdf_names.join(', ')} · {session.num_pages}p · {session.num_chunks} chunks
                </span>
              </div>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No document loaded</span>
            )}
          </div>

          {/* Tabs */}
          <div className="topbar-tabs" style={{ display: 'flex', gap: '0.1rem', flexShrink: 0, marginLeft: 'auto' }}>
            {TABS.map(({ id, Icon, full }) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                background: activeTab === id ? 'rgba(102,126,234,0.12)' : 'transparent',
                color: activeTab === id ? 'var(--accent)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: `2px solid ${activeTab === id ? 'var(--accent)' : 'transparent'}`,
                padding: '0.4rem 0.7rem', cursor: 'pointer',
                fontSize: '0.82rem', fontWeight: activeTab === id ? 600 : 400,
                transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
                borderRadius: '8px 8px 0 0', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
              }}>
                <Icon size={14} />
                <span className="tab-label">{full}</span>
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
