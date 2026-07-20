import { useEffect, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { getStudyNotes } from '../api'
import ExportButton from './ExportButton'
import { BookOpen, Layers, HelpCircle, Key, Eye } from 'lucide-react'

const FEATURES = [
  { Icon: Layers, label: 'Chapters', color: 'var(--accent)' },
  { Icon: Eye, label: 'Visual Overview', color: 'var(--cyan)' },
  { Icon: Key, label: 'Key Terms', color: 'var(--success)' },
  { Icon: HelpCircle, label: 'Practice Q\'s', color: 'var(--purple)' },
]

export default function StudyNotesTab({ session }) {
  const [notes,   setNotes]   = useState('')
  const [loading, setLoading] = useState(false)

  const generate = useCallback(async () => {
    if (!session.loaded) return toast.error('Upload a document first')
    setLoading(true); setNotes('')
    try { 
      const r = await getStudyNotes()
      setNotes(r.data.notes) 
    } catch (e) { 
      toast.error(e.response?.data?.detail || 'Generation failed') 
    } finally { 
      setLoading(false) 
    }
  }, [session.loaded])

  useEffect(() => {
    window.addEventListener('docmind_generate_notes', generate)
    return () => window.removeEventListener('docmind_generate_notes', generate)
  }, [generate])

  return (
    <div className="detail-page" style={{ height: '100%', overflowY: 'auto', padding: 'clamp(1rem, 3vw, 2rem)' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.4rem' }}>
            Academic Companion
          </div>
          <h2 className="panel-heading" style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.5px' }}>
            Interactive Study Notes
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.6 }}>
            DocMind AI parses complex text content to compile organized summaries, key definitions, contextual examples, visual conceptual layouts, and multiple practice questions to help you prepare for exams or presentations.
          </p>
        </div>

        {/* Features Row */}
          <div className="feature-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: '1.5rem' }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
                className="glass-card feature-card"
                style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.8rem',
                fontSize: '0.74rem',
                color: f.color
              }}
            >
              <f.Icon size={11} />
              <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Action Trigger */}
        <button
          onClick={generate}
          disabled={loading}
          className="btn-primary"
          style={{ padding: '0.7rem 1.6rem', fontSize: '0.82rem', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          {loading ? (
            <>
              <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              <span>Compiling Study Material...</span>
            </>
          ) : (
            <><BookOpen size={14} /> Generate Study Notes</>
          )}
        </button>

        {/* Loading progress */}
        {loading && (
          <div className="glass-card surface-card-soft" style={{ padding: '1.2rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Extracting core insights...</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{session.num_pages} pages</span>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '35%', background: 'var(--gradient)', borderRadius: '4px', animation: 'progress 1.8s ease-in-out infinite' }} />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '0.5rem', textAlign: 'center' }}>
              This takes about 1-2 minutes for large document indexes.
            </div>
          </div>
        )}

        {/* Results */}
        {notes && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeInUp 0.3s ease' }}>
            <div className="glass-card surface-card" style={{ padding: '1.5rem 2rem' }}>
              <div className="markdown"><ReactMarkdown>{notes}</ReactMarkdown></div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <ExportButton content={notes} filename="docmind_study_notes" label="Export Study Notes" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
