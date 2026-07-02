import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, ChevronDown, FileCode, FileText, Printer } from 'lucide-react'
import { notifPop } from '../motion'

export default function ExportButton({ content, filename, label = 'Export Analysis' }) {
  const [open, setOpen] = useState(false)

  const exportMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${filename}.md`
    a.click()
    setOpen(false)
  }

  const exportText = () => {
    const plain = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\|.*\|/g, '')
      .replace(/[-*+]\s/g, '• ')
    const blob = new Blob([plain], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${filename}.txt`
    a.click()
    setOpen(false)
  }

  const exportPDF = () => {
    const printWindow = window.open('', '_blank')
    const html = content
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[h|u|l|p])/gm, '<p>')
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim())
        return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>'
      })

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>${filename}</title>
      <style>
        body{font-family:Georgia,serif;max-width:800px;margin:2rem auto;line-height:1.7;color:#1a1a1a;font-size:14px}
        h1{font-size:1.8rem;border-bottom:2px solid #7877ff;padding-bottom:.5rem;color:#1a1a1a;margin-top:1.5rem}
        h2{font-size:1.3rem;color:#333;margin-top:1.5rem}
        h3{font-size:1.1rem;color:#555;margin-top:1rem}
        table{border-collapse:collapse;width:100%;margin:1rem 0}
        td,th{border:1px solid #ddd;padding:.5rem;text-align:left}
        th{background:#f8f8ff;font-weight:600}
        code{background:#f5f5f5;padding:.1rem .3rem;border-radius:3px;font-size:.9em;font-family:monospace}
        ul,ol{padding-left:1.5rem}
        li{margin:.3rem 0}
        strong{font-weight:700}
        @media print{body{margin:1rem}}
      </style>
    </head><body>${html}</body></html>`)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 300)
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        className="btn-subtle"
        style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
      >
        <Download size={13} /> {label} <ChevronDown size={12} style={{ opacity: 0.6 }} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop filter to capture dismiss click */}
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
            
            <motion.div
              variants={notifPop}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="glass"
              style={{
                position: 'absolute', bottom: '115%', left: 0, zIndex: 100,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '0.35rem', minWidth: '170px',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {[
                { label: 'Markdown (.md)', icon: FileCode, fn: exportMarkdown },
                { label: 'Plain Text (.txt)', icon: FileText, fn: exportText },
                { label: 'Print / Save PDF', icon: Printer, fn: exportPDF },
              ].map((opt, i) => (
                <button
                  key={i}
                  onClick={opt.fn}
                  style={{
                    display: 'flex', width: '100%', alignItems: 'center', gap: '0.4rem',
                    background: 'none', border: 'none', padding: '0.45rem 0.6rem',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                    fontSize: '0.78rem', fontFamily: 'var(--font-sans)',
                    borderRadius: '6px', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-glass)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                >
                  <opt.icon size={12} style={{ color: 'var(--accent)' }} />
                  {opt.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
