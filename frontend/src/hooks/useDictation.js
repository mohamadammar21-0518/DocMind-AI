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

  const recRef       = useRef(null)
  const committedRef = useRef('')
  const baseRef      = useRef('')
  const onUpdateRef  = useRef(null)  // latest callback — avoids re-creating toggle
  const pausedRef    = useRef(false) // sync ref readable inside event handlers

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

  // ── Shared handler factory ───────────────────────────────────
  // Both toggle() and resume() create a SpeechRecognition instance and attach
  // the same three event handlers. This factory returns them so there's a
  // single source of truth — no copy-paste divergence risk.
  const _makeHandlers = useCallback(() => {
    const onresult = (event) => {
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

    const onerror = (e) => {
      if (e.error !== 'no-speech') console.warn('SpeechRecognition error:', e.error)
      if (!pausedRef.current) { setListening(false); recRef.current = null }
    }

    const onend = () => {
      if (pausedRef.current) return  // paused — resume() will restart
      const parts = []
      if (baseRef.current)      parts.push(baseRef.current)
      if (committedRef.current) parts.push(committedRef.current)
      if (parts.length) onUpdateRef.current?.(parts.join(' '))
      setListening(false)
      recRef.current       = null
      committedRef.current = ''
      baseRef.current      = ''
    }

    return { onresult, onerror, onend }
  }, []) // refs are stable — no deps needed

  // ── Start a new recognition instance ────────────────────────
  const _startRec = useCallback(() => {
    const rec = new SpeechRecognition()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = 'en-US'
    rec.onstart        = () => setListening(true)
    const { onresult, onerror, onend } = _makeHandlers()
    rec.onresult = onresult
    rec.onerror  = onerror
    rec.onend    = onend
    rec.start()
    recRef.current = rec
  }, [_makeHandlers])

  // ── Pause: stop the recogniser but keep committed state ──────
  const pause = useCallback(() => {
    if (!recRef.current || pausedRef.current) return
    pausedRef.current = true
    setPaused(true)
    recRef.current.stop()  // triggers onend → we restart on resume
  }, [])

  // ── Resume: restart recognition, appending to committed ──────
  const resume = useCallback(() => {
    if (!supported || !pausedRef.current) return
    pausedRef.current = false
    setPaused(false)
    _startRec()
  }, [supported, _startRec])

  // ── Toggle on/off ────────────────────────────────────────────
  const toggle = useCallback((onUpdate, currentInput = '') => {
    if (!supported) return

    // Keep the latest callback accessible to handlers via ref
    onUpdateRef.current = onUpdate

    // Already listening or paused → full stop
    if (recRef.current || pausedRef.current) {
      stop()
      return
    }

    baseRef.current      = currentInput.trim()
    committedRef.current = ''
    _startRec()
  }, [supported, stop, _startRec])

  return { listening, paused, supported, toggle, stop, pause, resume }
}
