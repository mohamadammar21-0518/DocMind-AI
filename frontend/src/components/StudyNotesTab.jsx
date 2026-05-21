import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { getStudyNotes } from '../api'
import ExportButton from './ExportButton'

const FEATURES = [
  { icon: '📖', label: 'Sections',        color: '#667eea' },
  { icon: '💡', label: 'Examples',        color: '#f093fb' },
  { icon: '🔑', label: 'Key Terms',       color: '#43e97b' },
  { icon: '🗺️', label: 'Visual Overview', color: '#f6d365' },
  { icon: '📝', label: 'Practice Q\'s',   color: '#f5576c' },
]

export default function StudyNotesTab({ session }) {
  const [notes,   setNotes]   = useState('')
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    if (!session.loaded) return toast.error('Upload a document first')
    setLoading(true); setNotes('')
    try { const r = await getStudyNotes(); setNotes(r.data.notes) }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
    finally { setLoading(false) }
  }

  const download = () => {
    const blob = new Blob([notes], { type: 'text/markdown' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'study_notes.md'; a.click()
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '2.5rem' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>STUDENT OPTIMIZED</div>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>Study Notes</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
            AI-generated structured notes designed for students — with clear explanations, real examples, and visual overviews.
          </p>
        </div>

        {/* Feature badges */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          {FEATURES.map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: `${f.color}10`, border: `1px solid ${f.color}25`, borderRadius: '20px', padding: '0.35rem 0.9rem', fontSize: '0.78rem', color: f.color }}>
              {f.icon} {f.label}
            </div>
          ))}
        </div>

        <button onClick={generate} disabled={loading} className="btn-primary"
          style={{ padding: '0.8rem 2rem', fontSize: '0.95rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {loading ? <><Spinner /> Creating notes for {session.num_pages} pages...</> : '🎓 Generate Study Notes'}
        </button>

        {loading && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Generating comprehensive study notes...</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>{session.num_pages} pages</span>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '35%', background: 'linear-gradient(90deg,#f093fb,#667eea)', borderRadius: '4px', animation: 'progress 1.8s ease-in-out infinite' }} />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.6rem', textAlign: 'center' }}>
              ~1–2 minutes for large documents
            </div>
          </div>
        )}

        {notes && (
          <div style={{ animation: 'fadeInUp 0.4s ease' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2rem', marginBottom: '1rem' }}>
              <div className="markdown"><ReactMarkdown>{notes}</ReactMarkdown></div>
            </div>
            <ExportButton content={notes} filename="docmind_study_notes" label="Export Notes" />
          </div>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
}
