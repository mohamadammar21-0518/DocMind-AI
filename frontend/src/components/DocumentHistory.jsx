import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Trash2, FileText, ChevronDown } from 'lucide-react'
import { accordion, staggerContainer, staggerItem } from '../motion'

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
    window.dispatchEvent(new CustomEvent('docmind_history_updated'))
  } catch {}
}

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('docmind_history') || '[]')
  } catch { return [] }
}

export function clearHistory() {
  localStorage.removeItem('docmind_history')
  window.dispatchEvent(new CustomEvent('docmind_history_updated'))
}

export default function DocumentHistory() {
  const [history, setHistory] = useState(getHistory())
  const [open,    setOpen]    = useState(false)

  useEffect(() => {
    const refresh = () => setHistory(getHistory())
    window.addEventListener('docmind_history_updated', refresh)
    return () => window.removeEventListener('docmind_history_updated', refresh)
  }, [])

  const remove = (e, id) => {
    e.stopPropagation()
    const updated = history.filter(h => h.id !== id)
    localStorage.setItem('docmind_history', JSON.stringify(updated))
    setHistory(updated)
  }

  if (history.length === 0) return null

  return (
    <div style={{ marginTop: '0.4rem' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          fontSize: '0.72rem',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: 0,
          fontWeight: 500,
        }}
      >
        <Clock size={11} />
        Recent documents ({history.length})
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'inline-block' }}
        >
          <ChevronDown size={11} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={accordion}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
          >
            {history.map(h => (
              <motion.div
                key={h.id}
                style={{
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.4rem 0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'default',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <FileText size={12} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {h.pdfNames?.join(', ')}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>
                    {h.date} · {h.numPages}p · {h.numChunks} chunks
                  </div>
                </div>
                <button
                  onClick={(e) => remove(e, h.id)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-tertiary)',
                    cursor: 'pointer', padding: '0.2rem', flexShrink: 0, display: 'flex',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                >
                  <Trash2 size={11} />
                </button>
              </motion.div>
            ))}
            <button
              onClick={() => { clearHistory(); setHistory([]) }}
              className="btn-subtle"
              style={{
                width: '100%',
                padding: '0.3rem 0',
                fontSize: '0.68rem',
                borderRadius: '6px',
                textAlign: 'center',
              }}
            >
              Clear history log
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
