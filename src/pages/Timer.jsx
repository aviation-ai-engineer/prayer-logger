import { useState, useEffect, useRef, useCallback } from 'react'
import LogModal from '../components/LogModal'

function pad(n) { return String(n).padStart(2, '0') }

// Silent audio keep-awake: iOS suspends web pages in background unless an audio session is active.
function createKeepAwake() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.connect(ctx.destination)
    src.start(0)
    return { ctx, src }
  } catch (e) {
    return null
  }
}

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
  const audioRef       = useRef(null)
  const runningRef     = useRef(false)

  useEffect(() => { runningRef.current = running }, [running])

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

  const startKeepAwake = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.ctx.resume?.().catch(() => {})
      return
    }
    audioRef.current = createKeepAwake()
  }, [])

  const stopKeepAwake = useCallback(() => {
    if (!audioRef.current) return
    try { audioRef.current.src.stop() } catch {}
    try { audioRef.current.ctx.close() } catch {}
    audioRef.current = null
  }, [])

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

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (!runningRef.current) return
      const delta = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setElapsed(baseElapsedRef.current + delta)
      if (audioRef.current?.ctx?.state === 'suspended') {
        audioRef.current.ctx.resume?.().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => () => {
    clearInterval(intervalRef.current)
    stopKeepAwake()
  }, [stopKeepAwake])

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
