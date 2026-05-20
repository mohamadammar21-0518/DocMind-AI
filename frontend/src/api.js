import axios from 'axios'

// Uses VITE_API_URL env var in production, falls back to local proxy in dev
const BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({ baseURL: BASE })

export const uploadPDFs            = (formData)  => api.post('/upload', formData)
export const sendChat              = (data)      => api.post('/chat', data)
export const getSummary            = ()          => api.post('/summarize')
export const getStudyNotes         = ()          => api.post('/study-notes')
export const getSuggestedQuestions = ()          => api.post('/suggest-questions')
export const runEvaluation         = (questions) => api.post('/evaluate', { questions })
export const getSession            = ()          => api.get('/session')
export const clearSession          = ()          => api.delete('/session')
export const getModels             = ()          => api.get('/models')
