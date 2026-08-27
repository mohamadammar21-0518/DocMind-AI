import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { Bot, Settings, Upload, FileText, Zap, CheckCircle, ChevronDown, X, Trash2, File, Database, HelpCircle, Server } from 'lucide-react'
import { uploadPDFs, clearSession } from '../api'
import DocumentHistory, { saveToHistory } from './DocumentHistory'
import Spinner from './Spinner'
import { staggerContainer, staggerItem, fadeUp, uploadSuccess, accordion } from '../motion'

const MODELS = [
  { label: 'GPT-OSS 20B (Fast)',          desc: 'Best for quick answers',       color: 'var(--success)' },
  { label: 'GPT-OSS 120B (Best Quality)', desc: 'Highest quality reasoning',    color: 'var(--accent)' },
  { label: 'Gemma 2 9B',                  desc: 'Lightweight & efficient',      color: 'var(--cyan)' },
]

const STEPS = ['Reading PDF...', 'Chunking text...', 'Building index...', 'Finalizing...']

export default function Sidebar({ session, onUploaded, selectedModel, onModelChange }) {
  const [chunkSize,    setChunkSize]    = useState(1000)
  const [chunkOverlap, setChunkOverlap] = useState(200)
  const [files,        setFiles]        = useState([])
  const [loading,      setLoading]      = useState(false)
  const [loadingStep,  setLoadingStep]  = useState('')
  const [loadingIdx,   setLoadingIdx]   = useState(0)
  const [showSettings, setShowSettings] = useState(false)

  // Use controlled model from parent; fall back to local state if props not provided
  const model    = selectedModel ?? MODELS[0].label
  const setModel = onModelChange ?? (() => {})

  const onDrop = useCallback(accepted => setFiles(prev => [...prev, ...accepted]), [])
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, multiple: true, noClick: true,
  })

  const handleUpload = async () => {
    if (!files.length) {
      open()
      return
    }
    setLoading(true)
    setLoadingStep(STEPS[0])
    setLoadingIdx(0)
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    fd.append('groq_api_key', '')
    fd.append('model_label', model)
    fd.append('chunk_size', chunkSize)
    fd.append('chunk_overlap', chunkOverlap)

    let stepIdx = 0
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, STEPS.length - 1)
      setLoadingStep(STEPS[stepIdx])
      setLoadingIdx(stepIdx)
    }, 3000)

    try {
      const res = await uploadPDFs(fd)
      clearInterval(stepTimer)
      setLoadingStep('Done!')
      setLoadingIdx(STEPS.length)
      toast.success(res.data.message)
      saveToHistory(res.data.pdf_names, res.data.num_pages, res.data.num_chunks)
      setFiles([])
      onUploaded()
    } catch (e) {
      clearInterval(stepTimer)
      toast.error(e.response?.data?.detail || 'Upload failed', { duration: e.response?.status === 413 ? 6000 : 4000 })
    }
    finally { setLoading(false); setLoadingStep(''); setLoadingIdx(0) }
  }

  const handleClear = async () => {
    await clearSession()
    toast.success('Session cleared')
    onUploaded()
  }

  const removeFile = (idx) => setFiles(files.filter((_, j) => j !== idx))

  return (
    <div className="sidebar-shell">

      {/* Header / Brand */}
      <div className="sidebar-brand">
        <motion.img
          src="/logo.svg" alt="DocMind AI"
          whileHover={{ rotate: 8, scale: 1.08 }}
          style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6 }}
        />
        <div>
          <div className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            DocMind AI
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 600 }}>
            Intelligence Engine
          </div>
        </div>
      </div>

      {/* Main sidebar contents */}
      <div className="sidebar-content">
        
        {/* Model Selection */}
        <div className="sidebar-section">
          <SectionLabel icon={Bot}>Model</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {MODELS.map(m => {
              const active = model === m.label
              return (
                <motion.button
                  key={m.label}
                  type="button"
                  onClick={() => setModel(m.label)}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`sidebar-option ${active ? 'sidebar-option-active' : ''}`}
                  style={{
                    boxShadow: active ? 'var(--shadow-glow)' : 'none',
                    background: active ? 'var(--accent-muted)' : 'var(--bg-glass)',
                    borderColor: active ? 'var(--border-accent)' : 'var(--border)',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: active ? m.color : 'var(--text-tertiary)',
                    boxShadow: active ? `0 0 8px ${m.color}` : 'none',
                    transition: 'all 0.2s',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: active ? 600 : 400, color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{m.label}</div>
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.desc}</div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Collapsible Chunk Settings */}
        <div className="sidebar-section">
          <motion.button
            onClick={() => setShowSettings(!showSettings)}
            className="btn-subtle"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              width: 'fit-content', padding: 0,
            }}
          >
            <Settings size={12} /> Tuning configurations
            <motion.span
              animate={{ rotate: showSettings ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'inline-block' }}
            >
              <ChevronDown size={11} />
            </motion.span>
          </motion.button>

          <AnimatePresence>
            {showSettings && (
              <motion.div
                variants={accordion}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="glass-card surface-card-soft"
                style={{ padding: '0.8rem 1rem', marginTop: '0.4rem' }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Chunk Size: <strong style={{ color: 'var(--accent)' }}>{chunkSize}</strong>
                </div>
                <input type="range" min={300} max={2000} step={100} value={chunkSize} onChange={e => setChunkSize(+e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent)', marginBottom: '0.6rem', height: 4 }} />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Overlap: <strong style={{ color: 'var(--accent)' }}>{chunkOverlap}</strong>
                </div>
                <input type="range" min={0} max={500} step={50} value={chunkOverlap} onChange={e => setChunkOverlap(+e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent)', height: 4 }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Drag & Drop Upload */}
        <div className="sidebar-section">
          <SectionLabel icon={Upload}>Upload PDF</SectionLabel>
          <motion.div
            {...getRootProps()}
            onClick={open}
            className={`dropzone sidebar-upload ${isDragActive ? 'dropzone-active' : ''}`}
            whileHover={{ borderColor: 'var(--border-accent)', y: -1 }}
            animate={isDragActive ? { scale: 1.01, borderColor: 'var(--accent)' } : {}}
            style={{ padding: '1.2rem 1rem' }}
          >
            <input {...getInputProps()} />
            <motion.div animate={isDragActive ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }} style={{ marginBottom: '0.4rem' }}>
              <Upload size={22} color={isDragActive ? 'var(--accent)' : 'var(--text-secondary)'} />
            </motion.div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              {isDragActive ? 'Drop your PDFs here' : 'Drag & drop PDFs'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '0.1rem' }}>or click to browse</div>
          </motion.div>

          <button
            type="button"
            onClick={open}
            className="btn-subtle"
            style={{
              width: '100%',
              marginTop: '0.45rem',
              padding: '0.48rem 0.7rem',
              fontSize: '0.74rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
            }}
          >
            <Upload size={13} /> Browse PDF files
          </button>

          {/* Pending files */}
          <AnimatePresence>
            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
                {files.map((f, i) => {
                  const sizeMB = (f.size / 1024 / 1024).toFixed(1)
                  const tooLarge = f.size > 15 * 1024 * 1024
                  return (
                    <motion.div
                      key={f.name + i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10, height: 0 }}
                      className="sidebar-file"
                      style={{
                        background: tooLarge ? 'var(--danger-muted)' : 'var(--bg-glass)',
                        border: `1px solid ${tooLarge ? 'rgba(248, 113, 113, 0.2)' : 'var(--border)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
                        <File size={12} style={{ color: tooLarge ? 'var(--danger)' : 'var(--accent)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.74rem', color: tooLarge ? 'var(--danger)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name}
                        </span>
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>({sizeMB}MB)</span>
                        {tooLarge && <span className="badge badge-danger" style={{ fontSize: '0.58rem', padding: '0.05rem 0.3rem' }}>Max 15MB</span>}
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', flexShrink: 0, padding: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </AnimatePresence>

          {/* Action Trigger button */}
          <motion.button
            onClick={handleUpload}
            disabled={loading}
            whileHover={!loading ? { scale: 1.01 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
            className="btn-primary"
            style={{ width: '100%', marginTop: '0.6rem', padding: '0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                <span>{loadingStep}</span>
              </div>
            ) : (
              <>{files.length ? <><Zap size={14} /> Process Document</> : <><Upload size={14} /> Choose PDF files</>}</>
            )}
          </motion.button>

          {/* Progress Indicator */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ marginTop: '0.5rem' }}
              >
                <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                  {STEPS.map((step, idx) => (
                    <div
                      key={step}
                      style={{
                        flex: 1, height: 2, borderRadius: 1,
                        background: idx < loadingIdx ? 'var(--accent)' : idx === loadingIdx ? 'var(--accent)' : 'var(--border)',
                        opacity: idx <= loadingIdx ? 1 : 0.3,
                        boxShadow: idx === loadingIdx ? '0 0 6px var(--accent)' : 'none',
                        transition: 'all 0.3s',
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent PDFs */}
        <DocumentHistory />

        {/* Current document */}
        <AnimatePresence>
          {session.loaded && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card"
              style={{ padding: '0.9rem 1rem', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
            >
              <SectionLabel icon={CheckCircle} style={{ margin: 0 }}>Current document</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {session.pdf_names.map((n, i) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <FileText size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span>{n}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: 'var(--success)' }}>
                <span className="ai-status-dot" style={{ background: 'var(--success)' }} />
                <span>Local vector index active</span>
              </div>

              <button
                onClick={handleClear}
                className="btn-danger"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.45rem', fontSize: '0.74rem' }}
              >
                <Trash2 size={11} /> Clear Session
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div style={{
      fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-tertiary)',
      textTransform: 'uppercase', letterSpacing: '1px',
      margin: '0.3rem 0 0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem',
    }}>
      {Icon && <Icon size={11} />}{children}
    </div>
  )
}
