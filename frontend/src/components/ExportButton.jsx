import { useState } from 'react'
import { Download } from 'lucide-react'

export default function ExportButton({ content, filename, label = 'Export' }) {
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
    // Strip markdown for plain text
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
    // Open print dialog with formatted content
    const win = window.open('', '_blank')
    win.document.write(`
      <html>
        <head>
          <title>${filename}</title>
          <style>
            body { font-family: Georgia, serif; max-width: 800px; margin: 2rem auto; line-height: 1.7; color: #1a1a1a; }
            h1 { font-size: 1.8rem; border-bottom: 2px solid #667eea; padding-bottom: 0.5rem; color: #1a1a1a; }
            h2 { font-size: 1.3rem; color: #333; margin-top: 1.5rem; }
            h3 { font-size: 1.1rem; color: #555; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
            th { background: #f0f0f0; }
            code { background: #f5f5f5; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.9em; }
            pre { background: #f5f5f5; padding: 1rem; border-radius: 6px; overflow-x: auto; }
            blockquote { border-left: 3px solid #667eea; padding-left: 1rem; color: #555; }
            @media print { body { margin: 1rem; } }
          </style>
        </head>
        <body>
          <div id="content"></div>
          <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
          <script>
            document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(content)});
            setTimeout(() => window.print(), 500);
          </script>
        </body>
      </html>
    `)
    win.document.close()
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(!open)} className="btn-ghost"
        style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Download size={14} /> {label}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', top: '110%', left: 0, zIndex: 100,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '0.4rem', minWidth: '160px',
            boxShadow: 'var(--shadow)',
          }}>
            {[
              { label: '📄 Markdown (.md)', fn: exportMarkdown },
              { label: '📝 Plain Text (.txt)', fn: exportText },
              { label: '🖨️ Print / Save as PDF', fn: exportPDF },
            ].map(({ label, fn }) => (
              <button key={label} onClick={fn} style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', padding: '0.5rem 0.8rem',
                color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: '0.82rem', fontFamily: 'Inter,sans-serif',
                borderRadius: '6px', transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
