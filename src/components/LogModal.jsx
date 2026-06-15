import { useState, useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function pad(n) { return String(n).padStart(2, '0') }

function formatDateDMY(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

function parseDMY(str) {
  const [d, m, y] = str.split('/').map(Number)
  if (!d || !m || !y) return null
  const date = new Date(y, m - 1, d)
  if (isNaN(date)) return null
  return date
}

export default function LogModal({ elapsed, timerRef, onClose, onSaved }) {
  const { user } = useAuth()
  const [note, setNote] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [whatsappGroup, setWhatsappGroup] = useState('')

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60

  // Determine date — midnight check
  useEffect(() => {
    const now = new Date()
    const hour = now.getHours()
    // If it's between midnight and 4am, default to yesterday
    let defaultDate = new Date(now)
    if (hour < 4) {
      defaultDate.setDate(defaultDate.getDate() - 1)
    }
    setDateStr(formatDateDMY(defaultDate))
  }, [])

  // Screenshot timer card
  useEffect(() => {
    if (!timerRef.current) return
    html2canvas(timerRef.current, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
    }).then(canvas => {
      setScreenshot(canvas.toDataURL('image/png'))
    }).catch(() => {
      // Screenshot optional — proceed without
    })
  }, [timerRef])

  // Load WhatsApp group from settings
  useEffect(() => {
    supabase
      .from('user_settings')
      .select('whatsapp_group')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.whatsapp_group) setWhatsappGroup(data.whatsapp_group)
      })
  }, [user.id])

  async function handleSave() {
    const prayerDate = parseDMY(dateStr)
    if (!prayerDate) {
      setError('Invalid date. Use dd/mm/yyyy format.')
      return
    }

    setSaving(true)
    setError('')

    const { error: dbErr } = await supabase.from('prayer_logs').insert({
      user_id: user.id,
      logged_at: new Date().toISOString(),
      prayer_date: prayerDate.toISOString().split('T')[0],
      hours: h,
      minutes: m,
      seconds: s,
      total_seconds: elapsed,
      memory_note: note.trim() || null,
    })

    if (dbErr) {
      setError(dbErr.message)
      setSaving(false)
      return
    }

    setShowWhatsApp(true)
    setSaving(false)
  }

  function shareWhatsApp() {
    const caption = `🙏 Prayed in tongues on ${dateStr} — ${h > 0 ? `${h}h ` : ''}${m}m ${s}s`
    let url = `https://wa.me/?text=${encodeURIComponent(caption)}`
    if (whatsappGroup) {
      // If it's a phone number, use wa.me/<number>; if it's a group link, open directly
      if (whatsappGroup.startsWith('http')) {
        url = whatsappGroup
      } else {
        const num = whatsappGroup.replace(/\D/g, '')
        url = `https://wa.me/${num}?text=${encodeURIComponent(caption)}`
      }
    }
    window.open(url, '_blank')
  }

  if (showWhatsApp) {
    return (
      <div className="overlay">
        <div className="sheet glass w-full max-w-sm mx-4 mb-6 p-6 rounded-3xl space-y-5">
          {/* Success */}
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" className="w-7 h-7">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-cream">Logged!</h3>
            <p className="text-white/40 text-sm mt-1">{dateStr} · {h > 0 ? `${h}h ` : ''}{m}m {s}s</p>
          </div>

          {screenshot && (
            <img src={screenshot} alt="timer" className="w-full rounded-2xl opacity-80" />
          )}

          <button onClick={shareWhatsApp} className="btn-amber w-full flex items-center justify-center gap-3">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Share to WhatsApp
          </button>

          <button onClick={onSaved} className="btn-ghost w-full text-center">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="overlay">
      <div className="sheet glass w-full max-w-sm mx-4 mb-6 p-6 rounded-3xl space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-cream">Log Session</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/60 p-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Time summary */}
        <div className="glass-sm px-5 py-4 text-center">
          <p className="font-mono text-4xl font-bold text-amber-400">
            {pad(h)}:{pad(m)}:{pad(s)}
          </p>
          <p className="text-white/40 text-xs mt-1">Session duration</p>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
            Date (dd/mm/yyyy)
          </label>
          <input
            type="text"
            className="input-glass"
            value={dateStr}
            onChange={e => setDateStr(e.target.value)}
            placeholder="31/12/2025"
            maxLength={10}
          />
          {/* Quick toggle for midnight sessions */}
          <div className="flex gap-2 mt-2">
            {[0, -1].map(offset => {
              const d = new Date()
              d.setDate(d.getDate() + offset)
              const label = offset === 0 ? 'Today' : 'Yesterday'
              const val = formatDateDMY(d)
              return (
                <button
                  key={offset}
                  onClick={() => setDateStr(val)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    dateStr === val
                      ? 'border-amber-500/60 text-amber-400 bg-amber-500/10'
                      : 'border-white/10 text-white/30 bg-white/5'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Memory note */}
        <div>
          <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
            Memory Note <span className="normal-case font-normal text-white/25">(optional)</span>
          </label>
          <textarea
            className="input-glass resize-none h-20 text-sm leading-relaxed"
            placeholder="What did God speak today…"
            maxLength={200}
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <p className="text-right text-xs text-white/20 mt-1">{note.length}/200</p>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-amber w-full text-center disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Session'}
        </button>
      </div>
    </div>
  )
}
