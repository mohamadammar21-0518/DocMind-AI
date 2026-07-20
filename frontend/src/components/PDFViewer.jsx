import { useState, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from 'lucide-react'

// Use CDN worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export default function PDFViewer({ file, highlightPage, onClose }) {
  const [numPages,    setNumPages]    = useState(null)
  const [currentPage, setCurrentPage] = useState(highlightPage || 1)
  const [scale,       setScale]       = useState(1.0)
  const jumpInputRef = useRef(null)

  const onDocumentLoad = ({ numPages }) => {
    setNumPages(numPages)
    if (highlightPage) setCurrentPage(highlightPage)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      {/* Toolbar */}
      <div style={{
        width: '100%', background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '0.6rem 1.5rem',
        display: 'flex', alignItems: 'center', gap: '1rem',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1 }}>
          📄 {file?.name || 'PDF Viewer'}
        </span>

        {/* Page controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <IconBtn onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage <= 1}>
            <ChevronLeft size={16} />
          </IconBtn>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', minWidth: '80px', textAlign: 'center' }}>
            {currentPage} / {numPages || '?'}
          </span>
          <IconBtn onClick={() => setCurrentPage(p => Math.min(numPages, p+1))} disabled={currentPage >= numPages}>
            <ChevronRight size={16} />
          </IconBtn>
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <IconBtn onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
            <ZoomOut size={16} />
          </IconBtn>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', minWidth: '45px', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <IconBtn onClick={() => setScale(s => Math.min(2.5, s + 0.2))}>
            <ZoomIn size={16} />
          </IconBtn>
        </div>

        <IconBtn onClick={onClose}>
          <X size={16} />
        </IconBtn>
      </div>

      {/* PDF content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem', display: 'flex', justifyContent: 'center' }}>
        <Document
          file={file}
          onLoadSuccess={onDocumentLoad}
          loading={<div style={{ color: 'var(--text-secondary)', padding: '2rem' }}>Loading PDF...</div>}
          error={<div style={{ color: 'var(--danger)', padding: '2rem' }}>Failed to load PDF.</div>}
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            loading={<div style={{ color: 'var(--text-secondary)' }}>Loading page...</div>}
          />
        </Document>
      </div>

      {/* Page jump */}
      {numPages > 1 && (
        <div style={{
          padding: '0.8rem', borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)', width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '0.5rem', flexWrap: 'wrap',
        }}>
          {/* For small docs (≤20 pages): show page buttons */}
          {numPages <= 20
            ? Array.from({ length: numPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '6px',
                    background: currentPage === p ? 'var(--accent)' : 'var(--bg-glass)',
                    border: `1px solid ${currentPage === p ? 'var(--accent)' : 'var(--border)'}`,
                    color: currentPage === p ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'Inter,sans-serif',
                  }}
                >{p}</button>
              ))
            : (
              /* For large docs: show numeric input with Go button */
              <>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Jump to page:
                </span>
                <input
                  ref={jumpInputRef}
                  type="number"
                  min={1}
                  max={numPages}
                  defaultValue={currentPage}
                  key={currentPage}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const v = parseInt(e.currentTarget.value, 10)
                      if (v >= 1 && v <= numPages) setCurrentPage(v)
                    }
                  }}
                  style={{
                    width: '64px', height: '32px', borderRadius: '6px', textAlign: 'center',
                    background: 'var(--bg-glass)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: '0.82rem',
                    fontFamily: 'Inter,sans-serif', padding: '0 0.4rem',
                  }}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                  of {numPages}
                </span>
                <IconBtn
                  onClick={() => {
                    const v = parseInt(jumpInputRef.current?.value, 10)
                    if (v >= 1 && v <= numPages) setCurrentPage(v)
                  }}
                >
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0 4px' }}>Go</span>
                </IconBtn>
              </>
            )
          }
        </div>
      )}
    </div>
  )
}

function IconBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: 'var(--bg-glass)', border: '1px solid var(--border)',
      borderRadius: '6px', width: '30px', height: '30px',
      color: 'var(--text-secondary)', cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? 0.4 : 1, transition: 'all 0.15s',
    }}>
      {children}
    </button>
  )
}
