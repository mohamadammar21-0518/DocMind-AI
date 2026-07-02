import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { runEvaluation } from '../api'
import { BarChart2, ShieldCheck, CheckCircle2, Award, Clipboard, Download, HelpCircle } from 'lucide-react'

const METRICS = [
  { key: 'faithfulness',      icon: ShieldCheck, label: 'Faithfulness',      desc: 'Measures if the answer is strictly grounded in the document source context, preventing hallucinations.' },
  { key: 'answer_relevancy',  icon: CheckCircle2, label: 'Answer Relevancy',  desc: 'Measures how well the generated answer directly addresses the user query.' },
  { key: 'context_precision', icon: BarChart2, label: 'Context Precision', desc: 'Measures if the retrieved document chunks are accurate and precise to the question.' },
]

export default function EvaluationTab({ session }) {
  const [questions, setQuestions] = useState('What is the main topic of this document?\nWhat are the key concepts explained?\nWhat conclusions does the document make?')
  const [results,   setResults]   = useState(null)
  const [loading,   setLoading]   = useState(false)

  const run = async () => {
    if (!session.loaded) return toast.error('Upload a document first')
    const qs = questions.split('\n').map(q => q.trim()).filter(Boolean)
    if (!qs.length) return toast.error('Enter at least one question')
    setLoading(true)
    try {
      const res = await runEvaluation(qs)
      setResults(res.data)
    } catch (e) { 
      toast.error(e.response?.data?.detail || 'Evaluation failed') 
    } finally { 
      setLoading(false) 
    }
  }

  useEffect(() => {
    const handleRun = () => {
      run()
    }

    window.addEventListener('docmind_run_evaluation', handleRun)
    return () => window.removeEventListener('docmind_run_evaluation', handleRun)
  }, [session.loaded, questions])

  const scoreColor = (s) => s >= 0.8 ? 'var(--success)' : s >= 0.6 ? 'var(--warning)' : 'var(--danger)'
  const scoreBadgeColor = (s) => s >= 0.8 ? 'badge-success' : s >= 0.6 ? 'badge-warning' : 'badge-danger'

  const downloadCSV = () => {
    if (!results?.per_question) return
    const rows = results.per_question
    const keys = Object.keys(rows[0])
    const csv  = [keys.join(','), ...rows.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'rag_evaluation.csv'; a.click()
  }

  return (
    <div className="detail-page" style={{ height: '100%', overflowY: 'auto', padding: 'clamp(1rem, 3vw, 2rem)' }}>
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.4rem' }}>
            RAG Pipeline Diagnosis
          </div>
          <h2 className="panel-heading" style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.5px' }}>
            RAGAS Quality Evaluation
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.6 }}>
            Run real-time automated diagnostic evaluations on your document search pipeline. DocMind AI tests retrieval accuracy using metrics defined by the <strong style={{ color: 'var(--accent)' }}>RAGAS framework</strong>.
          </p>
        </div>

        {/* Diagnostic Metrics Row */}
        <div className="detail-grid" style={{ marginBottom: '1.5rem' }}>
          {METRICS.map(m => {
            const hasScore = results && results[m.key] !== undefined
            const score = hasScore ? results[m.key] : null
            return (
              <div key={m.key} className="glass-card feature-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{
                    background: 'var(--accent-muted)', padding: '0.4rem', borderRadius: '8px', display: 'flex', color: 'var(--accent)'
                  }}>
                    <m.icon size={14} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{m.label}</div>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{m.desc}</p>
                {hasScore && (
                  <div style={{ marginTop: '0.4rem' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: scoreColor(score), fontFamily: 'var(--font-display)' }}>
                      {(score * 100).toFixed(0)}%
                    </div>
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-tertiary)' }}>Ragas metric score</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Global Evaluation score */}
        {results && !results.error && (() => {
          const overall = (results.faithfulness + results.answer_relevancy + results.context_precision) / 3
          return (
            <div className="glass-card surface-card-soft" style={{ padding: '1rem 1.2rem', background: 'var(--accent-muted)', border: '1px solid var(--border-accent)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Award size={14} style={{ color: 'var(--accent)' }} /> Pipeline Score
                </span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: scoreColor(overall), fontFamily: 'var(--font-display)' }}>
                  {(overall * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${overall * 100}%`,
                  background: 'var(--gradient)',
                  borderRadius: '4px', transition: 'width 1s ease',
                }} />
              </div>
            </div>
          )
        })()}

        {/* Questions Area */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.4rem', fontWeight: 500 }}>
            <Clipboard size={12} /> Test Queries (One per line)
          </label>
          <textarea
            value={questions}
            onChange={e => setQuestions(e.target.value)}
            rows={4}
            className="input-field"
            style={{
              width: '100%',
              padding: '0.6rem 0.8rem',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-sans)',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Trigger Button & CSV export */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem' }}>
          <button
            onClick={run}
            disabled={loading}
            className="btn-primary"
            style={{ padding: '0.6rem 1.4rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            {loading ? (
              <>
                <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                <span>Running diagnostics...</span>
              </>
            ) : (
              'Run Evaluation'
            )}
          </button>
          {results && !results.error && (
            <button
              onClick={downloadCSV}
              className="btn-subtle"
              style={{ padding: '0.6rem 1.2rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Download size={13} /> Export Report
            </button>
          )}
        </div>

        {/* Ragas dependency errors */}
        {results?.error && (
          <div className="glass-card" style={{ background: 'var(--danger-muted)', border: '1px solid rgba(248,113,113,0.2)', padding: '1rem', borderRadius: '10px', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--danger)', fontSize: '0.78rem' }}>
            <HelpCircle size={14} style={{ flexShrink: 0, marginTop: '0.05rem' }} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Dependency Warning</div>
              {results.error}
            </div>
          </div>
        )}

        {/* Breakdown details */}
        {results?.per_question?.length > 0 && (
          <div style={{ marginTop: '1.5rem', animation: 'fadeInUp 0.3s ease' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
              Per-Question Quality Breakdown
            </h3>
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    {['Question', 'Faithfulness', 'Relevancy', 'Precision'].map(h => (
                      <th key={h} style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.per_question.map((row, idx) => {
                    const f = row.faithfulness ?? '-'
                    const a = row.answer_relevancy ?? '-'
                    const c = row.context_precision ?? '-'
                    return (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.user_input || row.question || '-'}
                        </td>
                        {[f, a, c].map((v, j) => (
                          <td key={j} style={{ color: typeof v === 'number' ? scoreColor(v) : 'var(--text-tertiary)', fontWeight: 600 }}>
                            {typeof v === 'number' ? `${(v * 100).toFixed(0)}%` : v}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
