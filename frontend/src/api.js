import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'
const api  = axios.create({ baseURL: BASE })

// ── Session ID — unique per browser, persisted in localStorage ───────────────
function getSessionId() {
  let id = localStorage.getItem('docmind_session_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('docmind_session_id', id)
  }
  return id
}

export const getSessionId_ = getSessionId  // export for use in components

// ── API calls ─────────────────────────────────────────────────────────────────
export const pingBackend = () => api.get('/ping')

export const uploadPDFs = (formData) => {
  formData.append('session_id', getSessionId())
  return api.post('/upload', formData)
}

export const sendChat = (data) =>
  api.post('/chat', { ...data, session_id: getSessionId() })

export const streamChat = (data, onToken, onSources, onDone, onError) => {
  const BASE = import.meta.env.VITE_API_URL || '/api'
  const es = new EventSource(`${BASE}/chat/stream?_=${Date.now()}`)

  // Use fetch with POST for SSE since EventSource only supports GET
  const ctrl = new AbortController()
  fetch(`${BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, session_id: getSessionId() }),
    signal: ctrl.signal,
  }).then(async res => {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.type === 'token')   onToken(msg.token)
            if (msg.type === 'sources') onSources(msg.sources)
            if (msg.type === 'done')    onDone()
            if (msg.type === 'error')   onError(msg.message)
          } catch {}
        }
      }
    }
  }).catch(e => { if (e.name !== 'AbortError') onError(e.message) })

  return () => ctrl.abort()  // returns cancel function
}

export const getSummary = () =>
  api.post('/summarize', { session_id: getSessionId() })

export const getStudyNotes = () =>
  api.post('/study-notes', { session_id: getSessionId() })

export const getSuggestedQuestions = () =>
  api.post('/suggest-questions', { session_id: getSessionId() })

export const runEvaluation = (questions) =>
  api.post('/evaluate', { questions, session_id: getSessionId() })

export const getSession = () =>
  api.get(`/session/${getSessionId()}`)

export const clearSession = () =>
  api.delete(`/session/${getSessionId()}`)

export const getModels = () => api.get('/models')
