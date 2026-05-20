import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { Key, Bot, Settings, Upload, FileText, Trash2, Download, Zap, CheckCircle } from 'lucide-react'
import { uploadPDFs, clearSession } from '../api'

const MODELS = ['Llama 3.1 8B (Fast)', 'Llama 3.3 70B (Best Quality)', 'Gemma 2 9B']

export default function Sidebar({ session, onUploaded }) {
  const [model,        setModel]        = useState(MODELS[0])
  const [chunkSize,    setChunkSize]    = useState(1000)
  const [chunkOverlap, setChunkOverlap] = useState(200)
  const [files,        setFiles]        = useState([])
  const [loading,      setLoading]      = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const onDrop = useCallback(a => setFiles(p => [...p, ...a]), [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, multiple: true,
  })

  const handleUpload = async () => {
    if (!files.length) return toast.error('Upload at least one PDF')
    setLoading(true)
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    fd.append('groq_api_key', '')   // backend uses env var
    fd.append('model_label',  model)
    fd.append('chunk_size',   chunkSize)
    fd.append('chunk_overlap',chunkOverlap)
    try {
      const res = await uploadPDFs(fd)
      toast.success(res.data.message)
      setFiles([])
      onUploaded()
    } catch (e) { toast.error(e.response?.data?.detail || 'Upload failed') }
    finally { setLoading(false) }
  }

  const handleClear = async () => {
    await clearSession(); toast.success('Session cleared'); onUploaded()
  }

  const Label = ({ icon: Icon, children }) => (
    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '1.2rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      {Icon && <Icon size={11} />}{children}
    </div>
  )

  return (
    <div style={{ width: '300px', height: '100vh', background: 'linear-gradient(180deg, rgba(13,13,26,0.98) 0%, rgba(18,18,42,0.98) 100%)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '1.5rem 1.2rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
          <img src="/logo.png" alt="DocMind AI" style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '10px' }} />
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: '1rem', background: 'linear-gradient(135deg,#667eea,#f093fb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>DocMind AI</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>Document Intelligence</div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.2rem 1.2rem' }}>

        <Label icon={Key}>Groq API Key</Label>
        <div style={{ position: 'relative' }}>
          <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="gsk_..." className="input-field"
            style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.9rem', fontSize: '0.85rem' }} />
          <button onClick={() => setShowKey(!showKey)} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>
            {showKey ? '🙈' : '👁️'}
          </button>
        </div>
        <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: 'var(--accent)', textDecoration: 'none', display: 'block', marginTop: '0.3rem' }}>
          ↗ Get free key at console.groq.com
        </a>

        <Label icon={Bot}>AI Model</Label>
        <select value={model} onChange={e => setModel(e.target.value)} className="input-field"
          style={{ width: '100%', padding: '0.6rem 0.9rem', fontSize: '0.85rem', cursor: 'pointer' }}>
          {MODELS.map(m => <option key={m} style={{ background: '#12122a' }}>{m}</option>)}
        </select>

        <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', marginTop: '0.6rem', padding: 0, fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Settings size={12} />
          Advanced chunking settings
          <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: showSettings ? 'rotate(180deg)' : '' }}>▾</span>
        </button>

        {showSettings && (
          <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Chunk Size: <strong style={{ color: 'var(--accent)' }}>{chunkSize}</strong></div>
            <input type="range" min={300} max={2000} step={100} value={chunkSize} onChange={e => setChunkSize(+e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)', marginBottom: '0.8rem' }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Overlap: <strong style={{ color: 'var(--accent)' }}>{chunkOverlap}</strong></div>
            <input type="range" min={0} max={500} step={50} value={chunkOverlap} onChange={e => setChunkOverlap(+e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)' }} />
          </div>
        )}

        <Label icon={Upload}>Upload Documents</Label>
        <div {...getRootProps()} style={{
          border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: '14px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer',
          background: isDragActive ? 'rgba(102,126,234,0.08)' : 'var(--bg-glass)',
          transition: 'all 0.3s ease',
        }}
          onMouseEnter={e => { if (!isDragActive) { e.currentTarget.style.borderColor = 'rgba(102,126,234,0.4)'; e.currentTarget.style.background = 'rgba(102,126,234,0.04)' } }}
          onMouseLeave={e => { if (!isDragActive) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-glass)' } }}>
          <input {...getInputProps()} />
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
            {isDragActive ? <Download size={28} color="var(--accent)" /> : <FileText size={28} color="var(--text-muted)" />}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {isDragActive ? 'Drop your PDFs here' : 'Drag & drop PDFs'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>or click to browse</div>
        </div>

        {files.length > 0 && (
          <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {files.map((f, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)', borderRadius: '8px', padding: '0.4rem 0.7rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {f.name}</span>
                <button onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1rem', flexShrink: 0, marginLeft: '0.4rem' }}>×</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={handleUpload} disabled={loading} className="btn-primary"
          style={{ width: '100%', marginTop: '0.8rem', padding: '0.75rem', fontSize: '0.9rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          {loading
            ? <><span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Processing...</>
            : <><Zap size={15} /> Process Documents</>}
        </button>

        {/* Session stats */}
        {session.loaded && (
          <div style={{ marginTop: '1.2rem', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle size={11} /> Active Session
            </div>
            {session.pdf_names.map((n, i) => (
              <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--accent)' }}>📄</span> {n}
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.8rem' }}>
              {[['Pages', session.num_pages, '#667eea'], ['Chunks', session.num_chunks, '#f093fb']].map(([l, v, c]) => (
                <div key={l} style={{ background: `${c}10`, border: `1px solid ${c}25`, borderRadius: '10px', padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#43e97b' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#43e97b', boxShadow: '0 0 6px #43e97b' }} />
              Hybrid Search + Reranking active
            </div>
            <button onClick={handleClear} style={{ width: '100%', marginTop: '0.8rem', background: 'transparent', border: '1px solid rgba(245,87,108,0.3)', color: 'var(--danger)', borderRadius: '10px', padding: '0.5rem', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,87,108,0.08)'; e.currentTarget.style.borderColor = 'var(--danger)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(245,87,108,0.3)' }}>
              🗑️ Clear Session
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '0.8rem 1.2rem', borderTop: '1px solid var(--border)', fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', flexShrink: 0 }}>
        LangChain · ChromaDB · Groq · FastAPI · React
      </div>
    </div>
  )
}
