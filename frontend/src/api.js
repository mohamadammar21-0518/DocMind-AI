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
