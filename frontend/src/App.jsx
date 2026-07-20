import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'react-hot-toast'
import { UserButton, useUser } from '@clerk/clerk-react'
import {
  MessageSquare, FileText, BookOpen, BarChart2, Sparkles,
  Sun, Moon, PanelLeftOpen, PanelLeftClose, Menu,
} from 'lucide-react'
import LandingPage from './components/LandingPage'
import Sidebar from './components/Sidebar'
import ChatTab from './components/ChatTab'
import SummaryTab from './components/SummaryTab'
import StudyNotesTab from './components/StudyNotesTab'
import EvaluationTab from './components/EvaluationTab'
import AIInsightsPanel from './components/AIInsightsPanel'
import { getSession, pingBackend, getSuggestedQuestions } from './api'
import { slideInLeft, pageTransition } from './motion'

const TABS = [
  { id: 'chat',     Icon: MessageSquare, full: 'Chat' },
  { id: 'summary',  Icon: FileText,      full: 'Summary' },
  { id: 'notes',    Icon: BookOpen,      full: 'Study Notes' },
  { id: 'eval',     Icon: BarChart2,     full: 'Evaluation' },
  { id: 'insights', Icon: Sparkles,      full: 'Insights' },
]

const isMobile  = () => window.innerWidth <= 1024

export default function App() {
  const { isLoaded, isSignedIn } = useUser()
  const [activeTab,   setActiveTab]   = useState('chat')
  const [session,     setSession]     = useState({ loaded: false, pdf_names: [], num_pages: 0, num_chunks: 0 })
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('docmind_chat')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [suggestedQuestions, setSuggestedQuestions] = useState([])
  const [loadingSug,  setLoadingSug]  = useState(false)
  const [selectedModel, setSelectedModel] = useState('Llama 3.1 8B (Fast)')
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile())
  const [mobile,      setMobile]      = useState(isMobile())
  const [theme,       setTheme]       = useState(() =>
    localStorage.getItem('docmind_theme') || 'dark'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('docmind_theme', theme)
  }, [theme])

  const refreshSession = async () => {
    try {
      const r = await getSession()
      setSession(r.data)
      if (r.data.loaded) fetchSuggestions()
    } catch {}
  }

  const fetchSuggestions = async () => {
    setLoadingSug(true)
    try {
      const r = await getSuggestedQuestions()
      setSuggestedQuestions(r.data.questions)
    } catch {}
    finally { setLoadingSug(false) }
  }

  useEffect(() => {
    try { localStorage.setItem('docmind_chat', JSON.stringify(chatHistory)) } catch {}
  }, [chatHistory])

  useEffect(() => { refreshSession() }, [])

  useEffect(() => {
    const checkBackend = async () => {
      const start = Date.now()
      try {
        await pingBackend()
        if (Date.now() - start > 3000) {
          toast('Backend was sleeping — it\'s now awake and ready!', {
            icon: '⚡', duration: 4000,
            style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 12 },
          })
        }
      } catch {
        toast('Backend is waking up... please wait 30 seconds then try again.', {
          icon: '⏳', duration: 8000,
          style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--warning)', borderRadius: 12 },
        })
      }
    }
    checkBackend()
  }, [])

  useEffect(() => {
    const handleResize = () => {
      const m = isMobile()
      setMobile(m)
      if (!m) setSidebarOpen(true)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toastStyle = {
    background: 'var(--bg-card)', color: 'var(--text-primary)',
    border: '1px solid var(--border)', borderRadius: 12,
  }

  if (!isLoaded) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <Toaster position="top-right" toastOptions={{ style: toastStyle }} />
        <div className="surface-card" style={{ padding: '1rem 1.2rem', color: 'var(--text-secondary)' }}>
          Loading auth...
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ style: toastStyle }} />
        <LandingPage onEnter={() => {}} />
      </>
    )
  }

  return (
    <div className="app-shell">
      <Toaster position="top-right" toastOptions={{ style: toastStyle }} />

      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobile && sidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Left Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            variants={slideInLeft}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              width: 'var(--sidebar-width)', flexShrink: 0,
              zIndex: mobile ? 200 : 10,
              ...(mobile ? { position: 'fixed', top: 0, left: 0, bottom: 0, boxShadow: 'var(--shadow-xl)' } : {}),
            }}
          >
            <Sidebar session={session} selectedModel={selectedModel} onModelChange={setSelectedModel} onUploaded={() => {
              refreshSession()
              setChatHistory([])
              if (mobile) setSidebarOpen(false)
            }} />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main workspace */}
      <div className={`workspace-shell${mobile ? ' workspace-shell--mobile' : ''}`}>

        {/* ── Topbar ──────────────────────────────────────────────── */}
        <header className="topbar-shell">

          {/* LEFT */}
          <div className="topbar-left">
            <motion.button
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              onClick={() => setSidebarOpen(v => !v)}
              className="icon-btn"
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {mobile
                ? <Menu size={16} />
                : sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />
              }
            </motion.button>

            <div className="topbar-brand">
              <img src="/logo.svg" alt="DocMind AI" className="topbar-brand-logo" />
              <span className="topbar-brand-name gradient-text">DocMind AI</span>
            </div>

            {/* live document status — hidden on mobile */}
            <div className={`topbar-doc-badge${session.loaded ? ' is-live' : ''}`}>
              <span className={session.loaded ? 'ai-status-dot' : 'ai-status-dot-inactive'} />
              <span className="topbar-doc-name">
                {session.loaded ? (session.pdf_names?.[0] ?? 'Document loaded') : 'No document'}
              </span>
            </div>
          </div>

          {/* CENTER — tabs (hidden on mobile, shown via bottom nav instead) */}
          <nav className="topbar-tabs" aria-label="Main navigation">
            {TABS.map(({ id, Icon, full }) => (
              <motion.button
                key={id}
                onClick={() => setActiveTab(id)}
                whileTap={{ scale: 0.95 }}
                className={`topbar-tab${activeTab === id ? ' topbar-tab--active' : ''}${id === 'insights' ? ' topbar-tab--insights' : ''}`}
              >
                <Icon size={13} strokeWidth={activeTab === id ? 2.5 : 2} />
                <span className="tab-label">{full}</span>
                {activeTab === id && (
                  <motion.span
                    layoutId="tab-underline"
                    className="topbar-tab-underline"
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  />
                )}
              </motion.button>
            ))}
          </nav>

          {/* RIGHT */}
          <div className="topbar-right">
            <motion.button
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="icon-btn"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.18 }}
                  style={{ display: 'flex' }}
                >
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </motion.span>
              </AnimatePresence>
            </motion.button>

            {/* Profile pill */}
            <div className="topbar-profile">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>

        {/* Tab content */}
        <div className="workspace-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              className="workspace-tab-panel"
            >
              {activeTab === 'chat'     && (
                <ChatTab
                  session={session}
                  chatHistory={chatHistory}
                  setChatHistory={setChatHistory}
                  suggestedQuestions={suggestedQuestions}
                  onSuggest={fetchSuggestions}
                  loadingSug={loadingSug}
                  mobile={mobile}
                  onOpenSidebar={() => setSidebarOpen(true)}
                  selectedModel={selectedModel}
                  onUploaded={() => {
                    refreshSession()
                    setChatHistory([])
                  }}
                />
              )}
              {activeTab === 'summary'  && <SummaryTab session={session} />}
              {activeTab === 'notes'    && <StudyNotesTab session={session} />}
              {activeTab === 'eval'     && <EvaluationTab session={session} />}
              {activeTab === 'insights' && (
                <AIInsightsPanel
                  session={session}
                  chatHistory={chatHistory}
                  suggestedQuestions={suggestedQuestions}
                  onSuggestQuestions={fetchSuggestions}
                  loadingSug={loadingSug}
                  onTabSwitch={setActiveTab}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Mobile Bottom Nav ──────────────────────────────────── */}
        {mobile && (
          <nav className="mobile-bottom-nav" aria-label="Main navigation">
            {TABS.map(({ id, Icon, full }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`mobile-nav-item${activeTab === id ? ' mobile-nav-item--active' : ''}${id === 'insights' ? ' mobile-nav-item--insights' : ''}`}
                aria-label={full}
              >
                <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 1.8} />
                <span className="mobile-nav-label">{full}</span>
                {activeTab === id && (
                  <motion.span
                    layoutId="mobile-nav-dot"
                    className="mobile-nav-dot"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
