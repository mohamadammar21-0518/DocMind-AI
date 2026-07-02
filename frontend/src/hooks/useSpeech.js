/**
 * useSpeech — Text-to-speech hook using Web Speech Synthesis API
 *
 * Key fix: accepts onBeforeSpeak / onAfterSpeak callbacks so the caller
 * can mute the microphone while audio is playing, preventing the mic from
 * picking up speaker output and writing it back into the input.
 *
 * Returns { speaking, speakingId, supported, speak, stop }
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function useSpeech() {
  const [speaking,   setSpeaking]   = useState(false)
  const [speakingId, setSpeakingId] = useState(null)
  const uttRef = useRef(null)

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => {
    return () => { if (supported) window.speechSynthesis.cancel() }
  }, [supported])

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
    setSpeakingId(null)
    uttRef.current = null
  }, [supported])

  /**
   * @param {string}           text          — raw text to speak (markdown stripped)
   * @param {string|number}    id            — unique id for this utterance
   * @param {() => void}       [onBefore]    — called just before speech starts (mute mic here)
   * @param {() => void}       [onAfter]     — called when speech ends/stops (unmute mic here)
   */
  const speak = useCallback((text, id, onBefore, onAfter) => {
    if (!supported) return

    // Toggle off if already speaking this message
    if (speakingId === id) {
      stop()
      onAfter?.()
      return
    }

    // Cancel anything currently playing
    window.speechSynthesis.cancel()

    // Strip markdown so it reads cleanly
    const clean = text
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`{1,3}[^`]*`{1,3}/g, '')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/^[-*•]\s+/gm, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim()

    if (!clean) return

    const utter = new SpeechSynthesisUtterance(clean)
    utter.lang  = 'en-US'
    utter.rate  = 1.0
    utter.pitch = 1.0

    // Pick a natural voice if available — voices may not be loaded yet
    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(v =>
        /Google US English|Samantha|Alex|Karen|Moira/i.test(v.name)
      ) || voices.find(v => v.lang === 'en-US') || null
      if (preferred) utter.voice = preferred
    }
    setVoice()
    if (!utter.voice) {
      window.speechSynthesis.onvoiceschanged = () => { setVoice(); window.speechSynthesis.onvoiceschanged = null }
    }

    utter.onstart = () => {
      setSpeaking(true)
      setSpeakingId(id)
      onBefore?.()           // ← mute the mic BEFORE speech starts
    }

    const cleanup = () => {
      setSpeaking(false)
      setSpeakingId(null)
      uttRef.current = null
      onAfter?.()            // ← unmute the mic AFTER speech ends
    }

    utter.onend   = cleanup
    utter.onerror = cleanup

    uttRef.current = utter
    window.speechSynthesis.speak(utter)
  }, [supported, speakingId, stop])

  return { speaking, speakingId, supported, speak, stop }
}
