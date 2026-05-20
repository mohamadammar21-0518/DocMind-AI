import { useState } from 'react'
import toast from 'react-hot-toast'
import { runEvaluation } from '../api'

const METRICS = [
  { key: 'faithfulness',      icon: '🎯', label: 'Faithfulness',      desc: 'Answer grounded in document — no hallucination' },
  { key: 'answer_relevancy',  icon: '💬', label: 'Answer Relevancy',  desc: 'Answer addresses the question asked' },
  { key: 'context_precision', icon: '🔍', label: 'Context Precision', desc: 'Retrieved chunks are relevant to the question' },
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
    } catch (e) { toast.error(e.response?.data?.detail || 'Evaluation failed') }
    finally { setLoading(false) }
  }

  const scoreColor = (s) => s >= 0.8 ? '#48bb78' : s >= 0.6 ? '#ecc94b' : '#fc8181'
  const scoreBadge = (s) => s >= 0.8 ? '🟢' : s >= 0.6 ? '🟡' : '🔴'

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
    <div style={{ height: '100%', overflowY: 'auto', padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ color: '#e2e8f0', marginBottom: '0.4rem' }}>📊 RAG Evaluation</h2>
        <p style={{ color: '#8892b0', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Automatically scores your RAG pipeline using <strong style={{ color: '#667eea' }}>RAGAS</strong> metrics.
        </p>

        {/* Metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {METRICS.map(m => (
            <div key={m.key} style={{
              background: '#1e1e35', border: '1px solid #2d2d4e', borderRadius: '12px', padding: '1.2rem',
            }}>
              <div style={{ fontSize: '1.5rem' }}>{m.icon}</div>
              <div style={{ fontWeight: 600, color: '#e2e8f0', margin: '0.4rem 0 0.2rem' }}>{m.label}</div>
              <div style={{ fontSize: '0.78rem', color: '#8892b0' }}>{m.desc}</div>
              {results && results[m.key] !== undefined && (
                <div style={{ marginTop: '0.8rem' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color: scoreColor(results[m.key]) }}>
                    {results[m.key].toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#4a5568' }}>out of 1.0</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Overall score */}
        {results && !results.error && (() => {
          const overall = (results.faithfulness + results.answer_relevancy + results.context_precision) / 3
          return (
            <div style={{ background: '#1e1e35', border: '1px solid #2d2d4e', borderRadius: '12px', padding: '1.2rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <span style={{ fontWeight: 600, color: '#e2e8f0' }}>Overall RAG Quality</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 700, color: scoreColor(overall) }}>
                  {scoreBadge(overall)} {(overall * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ background: '#2d2d4e', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${overall * 100}%`,
                  background: `linear-gradient(90deg, ${scoreColor(overall)}, #667eea)`,
                  borderRadius: '4px', transition: 'width 1s ease',
                }} />
              </div>
            </div>
          )
        })()}

        {/* Questions input */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.78rem', color: '#8892b0', display: 'block', marginBottom: '0.4rem' }}>
            Test questions (one per line):
          </label>
          <textarea value={questions} onChange={e => setQuestions(e.target.value)} rows={5} style={{
            width: '100%', background: '#1e1e35', border: '1px solid #2d2d4e',
            borderRadius: '10px', padding: '0.8rem', color: '#e2e8f0',
            fontSize: '0.85rem', outline: 'none', fontFamily: 'Inter,sans-serif',
            resize: 'vertical',
          }} />
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.5rem' }}>
          <button onClick={run} disabled={loading} style={{
            background: loading ? '#2d2d4e' : 'linear-gradient(135deg,#667eea,#764ba2)',
            color: 'white', border: 'none', borderRadius: '10px',
            padding: '0.7rem 1.5rem', fontWeight: 600, fontSize: '0.9rem',
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif',
          }}>
            {loading ? '⏳ Evaluating...' : '🧪 Run Evaluation'}
          </button>
          {results && !results.error && (
            <button onClick={downloadCSV} style={{
              background: 'transparent', border: '1px solid #667eea', color: '#667eea',
              borderRadius: '10px', padding: '0.7rem 1.2rem', cursor: 'pointer',
              fontFamily: 'Inter,sans-serif', fontSize: '0.85rem',
            }}>⬇️ Download Report</button>
          )}
        </div>

        {results?.error && (
          <div style={{ background: 'rgba(252,129,129,0.1)', border: '1px solid #fc8181', borderRadius: '10px', padding: '1rem', color: '#fc8181', fontSize: '0.85rem' }}>
            ⚠️ {results.error}
          </div>
        )}

        {/* Per-question table */}
        {results?.per_question?.length > 0 && (
          <div>
            <h3 style={{ color: '#e2e8f0', marginBottom: '0.8rem', fontSize: '1rem' }}>Per-Question Breakdown</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#1e1e35' }}>
                    {['Question', 'Faithfulness', 'Answer Relevancy', 'Context Precision'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.8rem', textAlign: 'left', color: '#8892b0', borderBottom: '1px solid #2d2d4e', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.per_question.map((row, i) => {
                    const f = row.faithfulness ?? row['faithfulness'] ?? '-'
                    const a = row.answer_relevancy ?? '-'
                    const c = row.context_precision ?? '-'
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #2d2d4e' }}>
                        <td style={{ padding: '0.6rem 0.8rem', color: '#e2e8f0', maxWidth: '300px' }}>{row.user_input || row.question || '-'}</td>
                        {[f, a, c].map((v, j) => (
                          <td key={j} style={{ padding: '0.6rem 0.8rem', color: typeof v === 'number' ? scoreColor(v) : '#8892b0', fontWeight: 600 }}>
                            {typeof v === 'number' ? `${scoreBadge(v)} ${v.toFixed(2)}` : v}
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
