import { useState, useEffect } from 'react'
import { Clock, Trash2, FileText, ChevronRight } from 'lucide-react'

const MAX_HISTORY = 10

export function saveToHistory(pdfNames, numPages, numChunks) {
  try {
    const history = getHistory()
    const entry = {
      id       : Date.now(),
      pdfNames,
      numPages,
      numChunks,
      date     : new Date().toLocaleDateString(),
      time     : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    const updated = [entry, ...history.filter(h => h.pdfNames.join() !== pdfNames.join())].slice(0, MAX_HISTORY)
    localStorage.setItem('docmind_history', JSON.stringify(updated))
  } catch {}
}

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('docmind_history') || '[]')
  } catch { return [] }
}

export function clearHistory() {
  localStorage.removeItem('docmind_history')
}

export default function DocumentHistory({ onSelect }) {
  const [history, setHistory] = useState(getHistory())
  const [open,    setOpen]    = useState(false)

  useEffect(() => {
    const refresh = () => setHistory(getHistory())
    window.addEventListener('docmind_history_updated', refresh)
    return () => window.removeEventListener('docmind_history_updated', refresh)
  }, [])

  const remove = (id) => {
    const updated = history.filter(h => h.id !== id)
    localStorage.setItem('docmind_history', JSON.stringify(updated))
    setHistory(updated)
  }

  if (history.length === 0) return null

  return (
    <div style={{ marginTop: '0.8rem' }}>
      <button onClick={() => setOpen(!open)} style={{
        background: 'none', border: 'none', color: 'var(--text-muted)',
        fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'Inter,sans-serif',
        display: 'flex', alignItems: 'center', gap: '0.4rem', padding: 0,
      }}>
        <Clock size={11} />
        Recent documents ({history.length})
        <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(90deg)' : '' }}>›</span>
      </button>

      {open && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {history.map(h => (
            <div key={h.id} style={{
              background: 'var(--bg-glass)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '0.5rem 0.7rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <FileText size={12} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.pdfNames.join(', ')}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {h.date} · {h.numPages}p · {h.numChunks} chunks
                </div>
              </div>
              <button onClick={() => remove(h.id)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: '0.2rem', flexShrink: 0,
              }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          <button onClick={() => { clearHistory(); setHistory([]) }} style={{
            background: 'none', border: 'none', color: 'var(--danger)',
            fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'Inter,sans-serif',
            textAlign: 'left', padding: '0.2rem 0',
          }}>
            Clear all history
          </button>
        </div>
      )}
    </div>
  )
}
