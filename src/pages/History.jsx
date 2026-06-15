import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function pad(n) { return String(n).padStart(2, '0') }

function fmtDuration(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${pad(d)}/${pad(m)}/${y}`
}

function getWeekLabel(weekOffset) {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay() - weekOffset * 7)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  if (weekOffset === 0) return 'This Week'
  if (weekOffset === 1) return 'Last Week'
  return `${pad(startOfWeek.getDate())}/${pad(startOfWeek.getMonth() + 1)} – ${pad(endOfWeek.getDate())}/${pad(endOfWeek.getMonth() + 1)}`
}

const TABS = ['Daily', 'Weekly', 'Monthly', 'Yearly']

export default function History() {
  const { user } = useAuth()
  const [tab, setTab] = useState('Daily')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
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

  // ---- Aggregations ----

  const daily = (() => {
    const map = {}
    for (const log of logs) {
      if (!map[log.prayer_date]) map[log.prayer_date] = { date: log.prayer_date, total: 0, sessions: 0, notes: [] }
      map[log.prayer_date].total += log.total_seconds
      map[log.prayer_date].sessions += 1
      if (log.memory_note) map[log.prayer_date].notes.push(log.memory_note)
    }
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
  })()

  const weekly = (() => {
    const map = {}
    for (const log of logs) {
      const d = new Date(log.prayer_date + 'T00:00:00')
      const sunday = new Date(d)
      sunday.setDate(d.getDate() - d.getDay())
      const key = sunday.toISOString().split('T')[0]
      if (!map[key]) map[key] = { weekStart: key, total: 0, days: new Set(), sessions: 0 }
      map[key].total += log.total_seconds
      map[key].days.add(log.prayer_date)
      map[key].sessions += 1
    }
    return Object.values(map)
      .map(w => ({ ...w, days: w.days.size }))
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
  })()

  const monthly = (() => {
    const map = {}
    for (const log of logs) {
      const key = log.prayer_date.slice(0, 7) // YYYY-MM
      if (!map[key]) map[key] = { month: key, total: 0, days: new Set(), sessions: 0 }
      map[key].total += log.total_seconds
      map[key].days.add(log.prayer_date)
      map[key].sessions += 1
    }
    return Object.values(map)
      .map(m => ({ ...m, days: m.days.size }))
      .sort((a, b) => b.month.localeCompare(a.month))
  })()

  const yearly = (() => {
    const map = {}
    for (const log of logs) {
      const key = log.prayer_date.slice(0, 4)
      if (!map[key]) map[key] = { year: key, total: 0, days: new Set(), sessions: 0 }
      map[key].total += log.total_seconds
      map[key].days.add(log.prayer_date)
      map[key].sessions += 1
    }
    return Object.values(map)
      .map(y => ({ ...y, days: y.days.size }))
      .sort((a, b) => b.year.localeCompare(a.year))
  })()

  function MonthLabel(key) {
    const [y, m] = key.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${months[parseInt(m) - 1]} ${y}`
  }

  return (
    <div className="h-full flex flex-col safe-top">
      {/* Header */}
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-cream">History</h1>
      </div>

      {/* Tab bar */}
      <div className="px-6 pb-3">
        <div className="glass-sm flex p-1 gap-1">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200 ${
                tab === t
                  ? 'bg-amber-500 text-indigo-950'
                  : 'text-white/40'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 scroll-area px-6 pb-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && logs.length === 0 && (
          <div className="text-center mt-20 text-white/30">
            <p className="text-4xl mb-3">🙏</p>
            <p className="font-medium">No sessions yet</p>
            <p className="text-sm mt-1">Start your first prayer timer!</p>
          </div>
        )}

        {/* DAILY */}
        {!loading && tab === 'Daily' && daily.map(day => (
          <div key={day.date} className="glass-sm px-5 py-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-cream">{fmtDate(day.date)}</p>
                <p className="text-white/40 text-xs mt-0.5">{day.sessions} session{day.sessions !== 1 ? 's' : ''}</p>
              </div>
              <p className="font-mono font-bold text-amber-400 text-lg">{fmtDuration(day.total)}</p>
            </div>
            {day.notes.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/6 space-y-1">
                {day.notes.map((n, i) => (
                  <p key={i} className="text-white/50 text-xs italic">"{n}"</p>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* WEEKLY */}
        {!loading && tab === 'Weekly' && weekly.map((week, i) => (
          <div key={week.weekStart} className="glass-sm px-5 py-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-cream">{getWeekLabel(i)}</p>
                <p className="text-white/40 text-xs mt-0.5">{week.days} day{week.days !== 1 ? 's' : ''} · {week.sessions} sessions</p>
              </div>
              <p className="font-mono font-bold text-amber-400 text-lg">{fmtDuration(week.total)}</p>
            </div>
            {/* Mini bar */}
            <div className="mt-3 h-1.5 rounded-full bg-white/6 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (week.days / 7) * 100)}%`,
                  background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                }}
              />
            </div>
            <p className="text-white/25 text-xs mt-1">{week.days}/7 days</p>
          </div>
        ))}

        {/* MONTHLY */}
        {!loading && tab === 'Monthly' && monthly.map(mo => {
          const daysInMonth = new Date(parseInt(mo.month.split('-')[0]), parseInt(mo.month.split('-')[1]), 0).getDate()
          return (
            <div key={mo.month} className="glass-sm px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-cream">{MonthLabel(mo.month)}</p>
                  <p className="text-white/40 text-xs mt-0.5">{mo.days} day{mo.days !== 1 ? 's' : ''} · {mo.sessions} sessions</p>
                </div>
                <p className="font-mono font-bold text-amber-400 text-lg">{fmtDuration(mo.total)}</p>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white/6 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (mo.days / daysInMonth) * 100)}%`,
                    background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                  }}
                />
              </div>
              <p className="text-white/25 text-xs mt-1">{mo.days}/{daysInMonth} days · avg {fmtDuration(Math.round(mo.total / mo.sessions))}/session</p>
            </div>
          )
        })}

        {/* YEARLY */}
        {!loading && tab === 'Yearly' && yearly.map(yr => (
          <div key={yr.year} className="glass-sm px-5 py-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-cream text-xl">{yr.year}</p>
                <p className="text-white/40 text-xs mt-0.5">{yr.days} days · {yr.sessions} sessions</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-amber-400 text-xl">{fmtDuration(yr.total)}</p>
                <p className="text-white/30 text-xs">avg {fmtDuration(Math.round(yr.total / yr.sessions))}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
