import { useState, useEffect, useRef, useCallback } from 'react'
import LogModal from '../components/LogModal'

function pad(n) { return String(n).padStart(2, '0') }

// ── Audio keep-awake ─────────────────────────────────────────────────────
// iOS only registers a "Now Playing" audio session (= lock screen controls)
// when an <audio> or <video> ELEMENT is playing.  AudioContext does NOT count.
// We keep one <audio> element looping a tiny near-silent WAV so that:
//   (a) iOS keeps the page alive in background, and
//   (b) the Media Session API can show lock-screen play/pause controls.
//
// The WAV is embedded as base64 (0.1 s, 8-bit 8kHz mono, low-amplitude 10Hz sine)
// so no extra file is needed.
const KEEPAWAKE_SRC =
  'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgI' +
  'CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYGBgYGBgYGBgYGBg' +
  'YGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBg' +
  'YGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBg' +
  'YGBgYKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBg' +
  'YGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBg' +
  'YGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBg' +
  'YGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYICAgICAgICAgICAgI' +
  'CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f39/f3' +
  '9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f35+fn5+fn5+fn5+' +
  'fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn' +
  '5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+' +
  'fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn' +
  '5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+' +
  'fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn9/f39/f39/f39/f3' +
  '9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/fw=='

function makeAudioEl() {
  try {
    const el = new Audio(KEEPAWAKE_SRC)
    el.loop   = true
    el.volume = 0.01   // 1 % — audible to iOS audio session, imperceptible to ears
    return el
  } catch (e) {
    return null
  }
}

// ── localStorage persistence ──────────────────────────────────────────────
const LS_KEY = 'prayerTimerState'
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) } catch { return null }
}
function saveTick(base, startTime) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ running: true, base, startTime })) } catch {}
}
function savePause(base) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ running: false, base })) } catch {}
}
function clearSaved() {
  try { localStorage.removeItem(LS_KEY) } catch {}
}

export default function Timer() {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [showModal, setShowModal] = useState(false)

  const intervalRef    = useRef(null)
  const startTimeRef   = useRef(null)
  const baseElapsedRef = useRef(0)
  const timerCardRef   = useRef(null)
  const audioRef       = useRef(null)   // <audio> element
  const runningRef     = useRef(false)

  useEffect(() => { runningRef.current = running }, [running])

  // ── Restore saved state on mount ─────────────────────────
  useEffect(() => {
    const saved = loadSaved()
    if (!saved) return
    if (saved.running && saved.startTime) {
      baseElapsedRef.current = saved.base
      startTimeRef.current   = saved.startTime
      const recovered = saved.base + Math.floor((Date.now() - saved.startTime) / 1000)
      setElapsed(recovered)
      setRunning(true)
      intervalRef.current = setInterval(() => {
        const delta = Math.floor((Date.now() - startTimeRef.current) / 1000)
        const cur   = baseElapsedRef.current + delta
        setElapsed(cur)
        if (delta % 10 === 0) updateLockScreen(true, cur)
        saveTick(baseElapsedRef.current, startTimeRef.current)
      }, 250)
    } else if (!saved.running && saved.base > 0) {
      baseElapsedRef.current = saved.base
      setElapsed(saved.base)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep-awake ────────────────────────────────────────────
  const startKeepAwake = useCallback(() => {
    if (!audioRef.current) audioRef.current = makeAudioEl()
    audioRef.current?.play().catch(() => {})
  }, [])

  const stopKeepAwake = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.pause()
    audioRef.current.currentTime = 0
  }, [])

  // ── Lock-screen metadata ──────────────────────────────────
  function updateLockScreen(isRunning, secs) {
    if (!('mediaSession' in navigator)) return
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`
    navigator.mediaSession.metadata = new MediaMetadata({
      title: isRunning ? `⏱ Praying — ${timeStr}` : `⏸ Paused — ${timeStr}`,
      artist: 'Tongues Prayer Logger',
    })
    navigator.mediaSession.playbackState = isRunning ? 'playing' : 'paused'
  }

  // ── Toggle ────────────────────────────────────────────────
  const toggle = useCallback(() => {
    if (runningRef.current) {
      clearInterval(intervalRef.current)
      const cur = baseElapsedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000)
      baseElapsedRef.current = cur
      setElapsed(cur)
      setRunning(false)
      stopKeepAwake()
      updateLockScreen(false, cur)
      savePause(cur)
    } else {
      startTimeRef.current  = Date.now()
      intervalRef.current   = setInterval(() => {
        const delta = Math.floor((Date.now() - startTimeRef.current) / 1000)
        const cur   = baseElapsedRef.current + delta
        setElapsed(cur)
        if (delta % 10 === 0) updateLockScreen(true, cur)
        saveTick(baseElapsedRef.current, startTimeRef.current)
      }, 250)
      setRunning(true)
      startKeepAwake()
      updateLockScreen(true, baseElapsedRef.current)
    }
  }, [startKeepAwake, stopKeepAwake])

  // ── Reset ─────────────────────────────────────────────────
  const reset = useCallback(() => {
    clearInterval(intervalRef.current)
    setRunning(false)
    setElapsed(0)
    baseElapsedRef.current = 0
    stopKeepAwake()
    clearSaved()
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none'
      navigator.mediaSession.metadata = null
    }
  }, [stopKeepAwake])

  // ── Done for Day ──────────────────────────────────────────
  const doneForDay = useCallback(() => {
    let cur = baseElapsedRef.current
    if (runningRef.current) {
      clearInterval(intervalRef.current)
      cur = baseElapsedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000)
      baseElapsedRef.current = cur
      setElapsed(cur)
      setRunning(false)
      stopKeepAwake()
    }
    if (cur === 0) return
    setShowModal(true)
  }, [stopKeepAwake])

  // ── Lock-screen handlers (stable via ref) ─────────────────
  const toggleRef = useRef(toggle)
  const resetRef  = useRef(reset)
  useEffect(() => { toggleRef.current = toggle }, [toggle])
  useEffect(() => { resetRef.current  = reset  }, [reset])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play',  () => toggleRef.current())
    navigator.mediaSession.setActionHandler('pause', () => toggleRef.current())
    navigator.mediaSession.setActionHandler('stop',  () => resetRef.current())
    try { navigator.mediaSession.setActionHandler('previoustrack', null) } catch {}
    try { navigator.mediaSession.setActionHandler('nexttrack',     null) } catch {}
    return () => {
      ['play','pause','stop'].forEach(a => {
        try { navigator.mediaSession.setActionHandler(a, null) } catch {}
      })
    }
  }, [])

  // ── Visibility change — resync time + resume audio ────────
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (!runningRef.current) return
      const delta = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setElapsed(baseElapsedRef.current + delta)
      if (audioRef.current?.paused) {
        audioRef.current.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // ── Cleanup on unmount ────────────────────────────────────
  useEffect(() => () => {
    clearInterval(intervalRef.current)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
  }, [])

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60

  return (
    <div className="h-full flex flex-col items-center justify-between px-6 safe-top pb-4 pt-8">
      <div className="text-center">
        <p className="text-white/30 text-xs font-semibold uppercase tracking-[0.2em]">Today's Session</p>
      </div>

      <div className="flex-1 flex items-center justify-center w-full">
        <div ref={timerCardRef} className="glass w-full max-w-xs py-12 px-6 flex flex-col items-center gap-8">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${running ? 'bg-amber-400' : 'bg-white/20'}`}
              style={running ? { boxShadow: '0 0 8px rgba(245,158,11,0.8)' } : {}}
            />
            <span className="text-white/30 text-xs font-medium tracking-widest uppercase">
              {running ? 'Running' : elapsed > 0 ? 'Paused' : 'Ready'}
            </span>
          </div>

          <div
            className={`font-mono text-6xl font-bold tracking-tight select-none ${running ? 'timer-running' : ''}`}
            style={{ color: '#fef3c7', letterSpacing: '-0.02em' }}
          >
            {h > 0 && (
              <>
                <span>{pad(h)}</span>
                <span className="text-amber-400/60 mx-1">:</span>
              </>
            )}
            <span>{pad(m)}</span>
            <span className="text-amber-400/60 mx-1">:</span>
            <span>{pad(s)}</span>
          </div>

          <p className="text-white/25 text-xs">
            {h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m} min ${s} sec` : `${s} seconds`}
          </p>
        </div>
      </div>

      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={toggle}
          className={`w-full py-4 rounded-3xl font-bold text-lg transition-all active:scale-95 ${
            running ? 'btn-ghost' : 'btn-amber'
          }`}
          style={running ? {} : { boxShadow: '0 0 30px rgba(245,158,11,0.3)' }}
        >
          {running ? '⏸ Pause' : elapsed > 0 ? '▶ Resume' : '▶ Start'}
        </button>

        {elapsed > 0 && !running && (
          <button
            onClick={doneForDay}
            className="w-full py-4 rounded-3xl font-bold text-lg text-amber-400 border border-amber-500/40 transition-all active:scale-95"
            style={{ background: 'rgba(245,158,11,0.08)' }}
          >
            ✓ Done for Day
          </button>
        )}

        {elapsed > 0 && (
          <button
            onClick={reset}
            className="w-full py-3 rounded-3xl text-sm text-white/30 font-medium transition-all active:scale-95"
          >
            Reset
          </button>
        )}
      </div>

      {showModal && (
        <LogModal
          elapsed={elapsed}
          timerRef={timerCardRef}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); reset() }}
        />
      )}
    </div>
  )
}
