import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, FileText, CheckCircle, HelpCircle, FileDigit,
  ChevronRight, RefreshCw, Database, Zap, Brain, BookOpen, BarChart2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { getSummary } from '../api'

export default function AIInsightsPanel({
  session, chatHistory = [], onSuggestQuestions, onTabSwitch,
  suggestedQuestions, loadingSug,
}) {
  const hasDoc = session?.loaded
  const [summary,        setSummary]        = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Reset summary when document changes so stale content isn't shown
  useEffect(() => {
    setSummary('')
  }, [session?.pdf_names?.join(',')])

  const latestSources = useMemo(() => {
    const last = [...chatHistory].reverse().find(m => m.role === 'bot' && m.sources?.length)
    return last?.sources || []
  }, [chatHistory])

  useEffect(() => {
    let active = true
    if (!hasDoc || summary || summaryLoading) return
    // Do NOT auto-fetch on mount — wait for explicit user action (Refresh button)
    return () => { active = false }
  }, [hasDoc])

  const keyPoints = useMemo(() => {
    if (!summary) return []
    return summary
      .split('\n')
      .map(l => l.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter(l => l.length > 20)
      .slice(0, 5)
  }, [summary])

  const refreshSummary = () => {
    setSummary('')
    setSummaryLoading(true)
    getSummary()
      .then(r => setSummary(r.data.summary || ''))
      .catch(() => setSummary(''))
      .finally(() => setSummaryLoading(false))
  }

  const goTo = (tabId, event) => {
    onTabSwitch(tabId)
    if (event) setTimeout(() => window.dispatchEvent(new CustomEvent(event)), 50)
  }

  return (
    <div className="insights-page">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="insights-page-header">
        <div className="insights-page-header-inner">
          <div className="insights-page-title-row">
            <div className="insights-page-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="insights-page-title">AI Insights</h2>
              <p className="insights-page-sub">
                {hasDoc
                  ? `${session.pdf_names?.join(', ')} · ${session.num_pages} pages · ${session.num_chunks} chunks`
                  : 'Upload a document to generate insights'}
              </p>
            </div>
            {hasDoc && <span className="badge badge-success" style={{ marginLeft: 'auto' }}>Live</span>}
          </div>
        </div>
      </div>

      {/* ── Grid layout ─────────────────────────────────────────── */}
      <div className="insights-page-body">
        <div className="insights-grid">

          {/* ── Document card ─────────────────────────────── */}
          <div className="insights-card insights-card--doc">
            <div className="icard-label">
              <FileText size={12} /> Document
            </div>
            {hasDoc ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                  {session.pdf_names?.join(', ')}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="badge">{session.num_pages} pages</span>
                  <span className="badge badge-purple">{session.num_chunks} chunks</span>
                  <span className="badge badge-success">RAG-Ready</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle size={11} style={{ color: 'var(--success)' }} /> Fully indexed and retrieval-ready
                </div>
              </div>
            ) : (
              <p className="insights-empty-note">Upload a PDF from the sidebar to get started.</p>
            )}
          </div>

          {/* ── Pipeline card ─────────────────────────────── */}
          {hasDoc && (
            <div className="insights-card">
              <div className="icard-label">
                <Database size={12} /> Retrieval Pipeline
              </div>
              <div className="icard-kv-list">
                <div className="icard-kv">
                  <span>Search Index</span>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>Hybrid (Vector + BM25)</span>
                </div>
                <div className="icard-kv">
                  <span>LLM Reranking</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Active</span>
                </div>
                <div className="icard-kv">
                  <span>Session Store</span>
                  <span>ChromaDB Local</span>
                </div>
                <div className="icard-kv">
                  <span>Context Window</span>
                  <span>{session.num_chunks} chunks</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Quick actions ──────────────────────────────── */}
          <div className="insights-card">
            <div className="icard-label">
              <Zap size={12} /> Quick Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
              {[
                { icon: '📝', label: 'Generate Full Summary',      tab: 'summary',  event: 'docmind_generate_summary' },
                { icon: '🎓', label: 'Create Study Notes',         tab: 'notes',    event: 'docmind_generate_notes' },
                { icon: '🧪', label: 'Evaluate Pipeline Accuracy', tab: 'eval',     event: 'docmind_run_evaluation' },
                { icon: '💬', label: 'Open Chat',                  tab: 'chat',     event: null },
              ].map(({ icon, label, tab, event }) => (
                <button
                  key={label}
                  onClick={() => goTo(tab, event)}
                  className="btn-subtle"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', textAlign: 'left', width: '100%' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                    {icon} {label}
                  </span>
                  <ChevronRight size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>

          {/* ── Summary card ───────────────────────────────── */}
          <div className="insights-card insights-card--wide">
            <div className="icard-label" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Sparkles size={12} /> Quick Summary
              </span>
              {hasDoc && (
                <button
                  onClick={refreshSummary}
                  className="btn-subtle"
                  style={{ padding: '0.2rem 0.55rem', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <RefreshCw size={10} /> Refresh
                </button>
              )}
            </div>
            <div style={{ marginTop: '0.65rem' }}>
              {summaryLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[100, 85, 90, 70].map((w, i) => (
                    <div key={i} className="skeleton skeleton-line" style={{ width: `${w}%` }} />
                  ))}
                </div>
              ) : summary ? (
                <div className="markdown" style={{ fontSize: '0.84rem' }}>
                  <ReactMarkdown>{summary.split('\n').slice(0, 6).join('\n')}</ReactMarkdown>
                </div>
              ) : (
                <p className="insights-empty-note">
                  {hasDoc
                    ? 'Click Refresh to generate a quick summary.'
                    : 'Upload a document first.'}
                </p>
              )}
            </div>
          </div>

          {/* ── Key points ─────────────────────────────────── */}
          <div className="insights-card">
            <div className="icard-label">
              <CheckCircle size={12} /> Key Points
            </div>
            <div style={{ marginTop: '0.55rem' }}>
              {keyPoints.length > 0 ? (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: 0, margin: 0, listStyle: 'none' }}>
                  {keyPoints.map((pt, i) => (
                    <li key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0, marginTop: '0.05rem' }}>•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="insights-empty-note">Key points appear after a summary is generated.</p>
              )}
            </div>
          </div>

          {/* ── Suggested questions ────────────────────────── */}
          <div className="insights-card">
            <div className="icard-label">
              <HelpCircle size={12} /> Suggested Questions
            </div>
            {suggestedQuestions?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.55rem' }}>
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onTabSwitch('chat')
                      setTimeout(() => window.dispatchEvent(new CustomEvent('docmind_send_message', { detail: q })), 50)
                    }}
                    className="btn-subtle"
                    style={{ textAlign: 'left', padding: '0.5rem 0.7rem', fontSize: '0.78rem', width: '100%' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p className="insights-empty-note">
                  {hasDoc ? 'Generate AI-powered question suggestions from your document.' : 'Upload a document first.'}
                </p>
                {hasDoc && (
                  <button
                    onClick={onSuggestQuestions}
                    disabled={loadingSug}
                    className="btn-primary"
                    style={{ padding: '0.5rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                  >
                    {loadingSug ? (
                      <>
                        <span style={{ width: 11, height: 11, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                        Generating...
                      </>
                    ) : '💡 Analyze & Suggest'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Recent citations ───────────────────────────── */}
          <div className="insights-card">
            <div className="icard-label">
              <FileDigit size={12} /> Recent Citations
            </div>
            <div style={{ marginTop: '0.55rem' }}>
              {latestSources.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {latestSources.slice(0, 5).map((s, i) => (
                    <div key={i} className="source-card" style={{ fontSize: '0.76rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                        <span className="citation-chip" style={{ fontSize: '0.65rem' }}>
                          Page {s.page}{s.source_file ? ` · ${s.source_file}` : ''}
                        </span>
                        {typeof s.score === 'number' && (
                          <span style={{ fontSize: '0.62rem', color: 'var(--success)', background: 'var(--success-muted)', padding: '0.05rem 0.3rem', borderRadius: 4, fontWeight: 600 }}>
                            {(s.score * 10).toFixed(0)}/10
                          </span>
                        )}
                      </div>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic', margin: 0 }}>
                        "{s.snippet?.slice(0, 120)}..."
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="insights-empty-note">Citations from your latest answer appear here.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
