import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { getSummary } from '../api'
import ExportButton from './ExportButton'
import { FileText, Cpu, CheckCircle, Clock } from 'lucide-react'

export default function SummaryTab({ session }) {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    if (!session.loaded) return toast.error('Upload a document first')
    setLoading(true); setSummary('')
    try { 
      const r = await getSummary()
      setSummary(r.data.summary) 
    } catch (e) { 
      toast.error(e.response?.data?.detail || 'Generation failed') 
    } finally { 
      setLoading(false) 
    }
  }

  useEffect(() => {
    const handleGenerate = () => {
      generate()
    }

    window.addEventListener('docmind_generate_summary', handleGenerate)
    return () => window.removeEventListener('docmind_generate_summary', handleGenerate)
  }, [session.loaded, session.num_pages])

  return (
    <div className="detail-page" style={{ height: '100%', overflowY: 'auto', padding: 'clamp(1rem, 3vw, 2rem)' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.4rem' }}>
            Document Insights
          </div>
          <h2 className="panel-heading" style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.5px' }}>
            Comprehensive Document Summary
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.6 }}>
            DocMind AI uses a hierarchical <strong style={{ color: 'var(--accent)' }}>Map-Reduce algorithm</strong>. It splits long document formats into sub-chapters, processes them concurrently, then weaves the summaries back into a structured report.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="feature-grid" style={{ marginBottom: '2rem' }}>
          {[
            { Icon: Cpu, title: 'Deep Semantic Scan', desc: 'Reads every embedded chunk, omitting no index boundaries.' },
            { Icon: CheckCircle, title: 'Multi-Perspective', desc: 'Synthesizes conclusions, key topics, timelines, and takeaways.' },
            { Icon: Clock, title: 'Time Saver', desc: 'Converts hour-long textbooks into digestible 2-minute reports.' },
          ].map((c, i) => (
            <div key={i} className="glass-card feature-card" style={{ padding: '0.8rem 1rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <div style={{
                background: 'var(--accent-muted)', padding: '0.4rem', borderRadius: '8px', display: 'flex', color: 'var(--accent)', flexShrink: 0
              }}>
                <c.Icon size={14} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>{c.title}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Trigger Button */}
        <button
          onClick={generate}
          disabled={loading}
          className="btn-primary"
          style={{ padding: '0.7rem 1.6rem', fontSize: '0.82rem', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          {loading ? (
            <>
              <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              <span>Analyzing context...</span>
            </>
          ) : (
            <><FileText size={14} /> Generate Summary</>
          )}
        </button>

        {/* Loading progress card */}
        {loading && (
          <div className="glass-card surface-card-soft" style={{ padding: '1.2rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Summarizing document pages...</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{session.num_pages} pages</span>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '35%', background: 'var(--gradient)', borderRadius: '4px', animation: 'progress 1.8s ease-in-out infinite' }} />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '0.5rem', textAlign: 'center' }}>
              For larger PDF textbooks, RAG-Map takes 30-40 seconds to process.
            </div>
          </div>
        )}

        {/* Results */}
        {summary && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeInUp 0.3s ease' }}>
            <div className="glass-card surface-card" style={{ padding: '1.5rem 2rem' }}>
              <div className="markdown"><ReactMarkdown>{summary}</ReactMarkdown></div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <ExportButton content={summary} filename="docmind_summary" label="Export Document Summary" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
