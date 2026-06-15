import { useState, useEffect, useRef, useCallback } from 'react'
import LogModal from '../components/LogModal'

function pad(n) {
  return String(n).padStart(2, '0')
}

export default function Timer() {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0) // seconds
  const [showModal, setShowModal] = useState(false)
  const intervalRef = useRef(null)
  const startTimeRef = useRef(null)
  const baseElapsedRef = useRef(0)
  const timerCardRef = useRef(null)

  // Start / Stop
  const toggle = useCallback(() => {
    if (running) {
      clearInterval(intervalRef.current)
      baseElapsedRef.current = elapsed
      setRunning(false)
    } else {
      startTimeRef.current = Date.now()
      intervalRef.current = setInterval(() => {
        const delta = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setElapsed(baseElapsedRef.current + delta)
      }, 250)
      setRunning(true)
    }
  }, [running, elapsed])

  const reset = useCallback(() => {
    clearInterval(intervalRef.current)
    setRunning(false)
    setElapsed(0)
    baseElapsedRef.current = 0
  }, [])

  const doneForDay = useCallback(() => {
    if (running) {
      clearInterval(intervalRef.current)
      baseElapsedRef.current = elapsed
      setRunning(false)
    }
    if (elapsed === 0) return
    setShowModal(true)
  }, [running, elapsed])

  useEffect(() => () => clearInterval(intervalRef.current), [])

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60

  return (
    <div className="h-full flex flex-col items-center justify-between px-6 safe-top pb-4 pt-8">
      {/* Title */}
      <div className="text-center">
        <p className="text-white/30 text-xs font-semibold uppercase tracking-[0.2em]">Today's Session</p>
      </div>

      {/* Timer Card */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div ref={timerCardRef} className="glass w-full max-w-xs py-12 px-6 flex flex-col items-center gap-8">
          {/* Running indicator dot */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${running ? 'bg-amber-400' : 'bg-white/20'}`}
              style={running ? { boxShadow: '0 0 8px rgba(245,158,11,0.8)' } : {}} />
            <span className="text-white/30 text-xs font-medium tracking-widest uppercase">
              {running ? 'Running' : elapsed > 0 ? 'Paused' : 'Ready'}
            </span>
          </div>

          {/* Time display */}
          <div
            className={`font-mono text-6xl font-bold tracking-tight select-none ${running ? 'timer-running' : ''}`}
            style={{ color: '#fef3c7', letterSpacing: '-0.02em' }}
          >
            {h > 0 && <><span>{pad(h)}</span><span className="text-amber-400/60 mx-1">:</span></>}
            <span>{pad(m)}</span>
            <span className="text-amber-400/60 mx-1">:</span>
            <span>{pad(s)}</span>
          </div>

          {/* Sub label */}
          <p className="text-white/25 text-xs">
            {h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m} min ${s} sec` : `${s} seconds`}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-xs space-y-3">
        {/* Start / Pause */}
        <button
          onClick={toggle}
          className={`w-full py-4 rounded-3xl font-bold text-lg transition-all active:scale-95 ${
            running
              ? 'btn-ghost'
              : 'btn-amber'
          }`}
          style={running ? {} : { boxShadow: '0 0 30px rgba(245,158,11,0.3)' }}
        >
          {running ? '⏸ Pause' : elapsed > 0 ? '▶ Resume' : '▶ Start'}
        </button>

        {/* Done for Day — primary CTA */}
        {elapsed > 0 && !running && (
          <button
            onClick={doneForDay}
            className="w-full py-4 rounded-3xl font-bold text-lg text-amber-400 border border-amber-500/40 transition-all active:scale-95"
            style={{ background: 'rgba(245,158,11,0.08)' }}
          >
            ✓ Done for Day
          </button>
        )}

        {/* Reset */}
        {elapsed > 0 && (
          <button
            onClick={reset}
            className="w-full py-3 rounded-3xl text-sm text-white/30 font-medium transition-all active:scale-95"
          >
            Reset
          </button>
        )}
      </div>

      {/* Log Modal */}
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
