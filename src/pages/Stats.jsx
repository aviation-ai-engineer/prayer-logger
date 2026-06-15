import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function fmtDuration(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function computeStreak(logs) {
  if (!logs.length) return 0
  const dates = [...new Set(logs.map(l => l.prayer_date))].sort((a, b) => b.localeCompare(a))
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // Must have logged today or yesterday to have an active streak
  if (dates[0] !== today && dates[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T00:00:00')
    const curr = new Date(dates[i] + 'T00:00:00')
    const diff = (prev - curr) / 86400000
    if (diff === 1) {
      streak++
    } else {
      break
    }
  }
  return streak
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="glass-sm px-5 py-5 flex flex-col gap-1">
      <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">{label}</p>
      <p className={`font-bold text-3xl ${accent ? 'text-amber-400' : 'text-cream'}`}>{value}</p>
      {sub && <p className="text-white/30 text-xs">{sub}</p>}
    </div>
  )
}

export default function Stats() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('prayer_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('prayer_date', { ascending: false })
      .then(({ data }) => {
        setLogs(data || [])
        setLoading(false)
      })
  }, [user.id])

  const totalSeconds = logs.reduce((s, l) => s + l.total_seconds, 0)
  const sessionCount = logs.length
  const streak = computeStreak(logs)
  const avgSeconds = sessionCount > 0 ? Math.round(totalSeconds / sessionCount) : 0
  const uniqueDays = new Set(logs.map(l => l.prayer_date)).size

  // Best day
  const dayMap = {}
  for (const log of logs) {
    dayMap[log.prayer_date] = (dayMap[log.prayer_date] || 0) + log.total_seconds
  }
  const bestDay = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0]

  // Last 7 days bar chart data
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    return { date: d, secs: dayMap[d] || 0 }
  }).reverse()
  const max7 = Math.max(...last7.map(d => d.secs), 1)

  const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div className="h-full flex flex-col safe-top">
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-cream">Stats</h1>
      </div>

      <div className="flex-1 scroll-area px-6 pb-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center mt-20 text-white/30">
            <p className="text-4xl mb-3">📊</p>
            <p className="font-medium">No data yet</p>
            <p className="text-sm mt-1">Your stats will appear after your first session.</p>
          </div>
        ) : (
          <>
            {/* Last 7 days mini chart */}
            <div className="glass px-5 py-5">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-4">Last 7 Days</p>
              <div className="flex items-end gap-2 h-20">
                {last7.map((d, i) => {
                  const pct = (d.secs / max7) * 100
                  const dayLabel = dayLabels[new Date(d.date + 'T12:00:00').getDay()]
                  const isToday = d.date === new Date().toISOString().split('T')[0]
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{ height: '60px' }}>
                        <div
                          className="w-full rounded-t-lg transition-all duration-500"
                          style={{
                            height: `${Math.max(pct, d.secs > 0 ? 8 : 2)}%`,
                            background: d.secs > 0
                              ? 'linear-gradient(180deg, #f59e0b, #d97706)'
                              : 'rgba(255,255,255,0.06)',
                            minHeight: d.secs > 0 ? '6px' : '2px',
                          }}
                        />
                      </div>
                      <span className={`text-[10px] font-medium ${isToday ? 'text-amber-400' : 'text-white/25'}`}>
                        {dayLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Streak + total */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-sm px-5 py-5 flex flex-col items-center text-center">
                <p className="text-4xl mb-1">🔥</p>
                <p className="font-bold text-3xl text-amber-400">{streak}</p>
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mt-1">Day Streak</p>
              </div>
              <StatCard label="Total Time" value={fmtDuration(totalSeconds)} sub={`${Math.round(totalSeconds / 60)} minutes`} accent />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Sessions" value={sessionCount} sub={`${uniqueDays} unique days`} />
              <StatCard label="Avg Session" value={fmtDuration(avgSeconds)} sub="per session" accent />
            </div>

            {bestDay && (
              <div className="glass-sm px-5 py-4">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Personal Best</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono font-bold text-2xl text-amber-400">{fmtDuration(bestDay[1])}</p>
                    <p className="text-white/30 text-xs mt-0.5">
                      {new Date(bestDay[0] + 'T00:00:00').toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                  </div>
                  <span className="text-3xl">🏆</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
