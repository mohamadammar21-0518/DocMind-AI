import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { getSummary } from '../api'
import ExportButton from './ExportButton'

export default function SummaryTab({ session }) {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    if (!session.loaded) return toast.error('Upload a document first')
    setLoading(true); setSummary('')
    try { const r = await getSummary(); setSummary(r.data.summary) }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
    finally { setLoading(false) }
  }

  const download = () => {
    const blob = new Blob([summary], { type: 'text/markdown' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'summary.md'; a.click()
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '2.5rem' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>AI POWERED</div>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>Document Summary</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
            Uses <strong style={{ color: 'var(--accent)' }}>Map-Reduce</strong> — reads every chunk of your document, summarizes each section, then combines into a comprehensive structured overview.
          </p>
        </div>

        {/* Info cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { icon: '📖', label: 'Full Coverage', desc: 'Every page analyzed' },
            { icon: '🗂️', label: 'Structured', desc: 'Overview · Topics · Key Points · Conclusion' },
            { icon: '⚡', label: 'Fast', desc: 'Batched API calls' },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{c.icon}</div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.2rem' }}>{c.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.desc}</div>
            </div>
          ))}
        </div>

        <button onClick={generate} disabled={loading} className="btn-primary"
          style={{ padding: '0.8rem 2rem', fontSize: '0.95rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {loading ? <><Spinner /> Summarizing {session.num_pages} pages...</> : '📝 Generate Summary'}
        </button>

        {loading && <ProgressCard pages={session.num_pages} label="Reading and summarizing all pages..." />}

        {summary && (
          <div style={{ animation: 'fadeInUp 0.4s ease' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2rem', marginBottom: '1rem' }}>
              <div className="markdown"><ReactMarkdown>{summary}</ReactMarkdown></div>
            </div>
            <ExportButton content={summary} filename="docmind_summary" label="Export Summary" />
          </div>
        )}
      </div>
    </div>
  )
}

function ProgressCard({ pages, label }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>{pages} pages</span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '35%', background: 'linear-gradient(90deg,#667eea,#f093fb)', borderRadius: '4px', animation: 'progress 1.8s ease-in-out infinite' }} />
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.6rem', textAlign: 'center' }}>
        This may take 30–60 seconds for large documents
      </div>
    </div>
  )
}

function Spinner() {
  return <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
}
