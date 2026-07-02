/**
 * useDictation — browser Web Speech API hook
 *
 * Exposes pause() / resume() so external code (e.g. TTS) can silence the
 * mic while audio is playing without losing committed transcript state.
 *
 * Returns { listening, paused, supported, toggle, stop, pause, resume }
 */
import { useRef, useState, useCallback } from 'react'

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null

export function useDictation() {
  const [listening, setListening] = useState(false)
  const [paused,    setPaused]    = useState(false)

  const recRef         = useRef(null)
  const committedRef   = useRef('')
  const baseRef        = useRef('')
  const onUpdateRef    = useRef(null)   // keep latest callback without re-creating toggle
  const pausedRef      = useRef(false)  // sync ref so event handlers can read it

  const supported = Boolean(SpeechRecognition)

  // ── Hard stop ────────────────────────────────────────────────
  const stop = useCallback(() => {
    recRef.current?.stop()
    recRef.current       = null
    committedRef.current = ''
    baseRef.current      = ''
    pausedRef.current    = false
    setPaused(false)
    setListening(false)
  }, [])

  // ── Pause: stop the recogniser but keep committed state ──────
  const pause = useCallback(() => {
    if (!recRef.current || pausedRef.current) return
    pausedRef.current = true
    setPaused(true)
    recRef.current.stop()   // triggers onend → we restart on resume
  }, [])

  // ── Resume: restart recognition, appending to committed ──────
  const resume = useCallback(() => {
    if (!supported || !pausedRef.current) return
    pausedRef.current = false
    setPaused(false)

    const rec = new SpeechRecognition()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = 'en-US'

    rec.onstart = () => setListening(true)

    rec.onresult = (event) => {
      let newFinal   = ''
      let interimNow = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) newFinal   += t
        else                           interimNow += t
      }
      if (newFinal) {
        committedRef.current = committedRef.current
          ? committedRef.current + ' ' + newFinal.trim()
          : newFinal.trim()
      }
      const parts = []
      if (baseRef.current)      parts.push(baseRef.current)
      if (committedRef.current) parts.push(committedRef.current)
      if (interimNow.trim())    parts.push(interimNow.trim())
      onUpdateRef.current?.(parts.join(' '))
    }

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') console.warn('SpeechRecognition error:', e.error)
      if (!pausedRef.current) { setListening(false); recRef.current = null }
    }

    rec.onend = () => {
      if (pausedRef.current) return   // don't clear state — we'll resume
      const parts = []
      if (baseRef.current)      parts.push(baseRef.current)
      if (committedRef.current) parts.push(committedRef.current)
      if (parts.length) onUpdateRef.current?.(parts.join(' '))
      setListening(false)
      recRef.current       = null
      committedRef.current = ''
      baseRef.current      = ''
    }

    rec.start()
    recRef.current = rec
  }, [supported])

  // ── Toggle on/off ────────────────────────────────────────────
  const toggle = useCallback((onUpdate, currentInput = '') => {
    if (!supported) return

    // Store callback so pause/resume can use it
    onUpdateRef.current = onUpdate

    // Already listening or paused → full stop
    if (recRef.current || pausedRef.current) {
      stop()
      return
    }

    baseRef.current      = currentInput.trim()
    committedRef.current = ''

    const rec = new SpeechRecognition()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = 'en-US'

    rec.onstart = () => setListening(true)

    rec.onresult = (event) => {
      let newFinal   = ''
      let interimNow = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) newFinal   += t
        else                           interimNow += t
      }
      if (newFinal) {
        committedRef.current = committedRef.current
          ? committedRef.current + ' ' + newFinal.trim()
          : newFinal.trim()
      }
      const parts = []
      if (baseRef.current)      parts.push(baseRef.current)
      if (committedRef.current) parts.push(committedRef.current)
      if (interimNow.trim())    parts.push(interimNow.trim())
      onUpdateRef.current?.(parts.join(' '))
    }

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') console.warn('SpeechRecognition error:', e.error)
      if (!pausedRef.current) { setListening(false); recRef.current = null }
    }

    rec.onend = () => {
      if (pausedRef.current) return
      const parts = []
      if (baseRef.current)      parts.push(baseRef.current)
      if (committedRef.current) parts.push(committedRef.current)
      if (parts.length) onUpdateRef.current?.(parts.join(' '))
      setListening(false)
      recRef.current       = null
      committedRef.current = ''
      baseRef.current      = ''
    }

    rec.start()
    recRef.current = rec
  }, [supported, stop])

  return { listening, paused, supported, toggle, stop, pause, resume }
}
