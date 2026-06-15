import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const DELETE_PASSWORD = 'scripture'

function pad(n) { return String(n).padStart(2, '0') }

function fmtTime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`
  return `${pad(m)}m ${pad(s)}s`
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const [whatsappGroup, setWhatsappGroup] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Delete state
  const [showDelete, setShowDelete] = useState(false)
  const [deleteDate, setDeleteDate] = useState('')
  const [deletePass, setDeletePass] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [sessions, setSessions] = useState(null)
  const [loadingS, setLoadingS] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

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

  async function saveWhatsApp() {
    setSaving(true)
    setSaved(false)
    await supabase.from('user_settings').upsert({
      user_id: user.id,
      whatsapp_group: whatsappGroup,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function loadSessions() {
    setDeleteError('')
    if (deletePass !== DELETE_PASSWORD) {
      setDeleteError('Incorrect password.')
      return
    }
    if (!deleteDate) {
      setDeleteError('Enter a date in dd/mm/yyyy format.')
      return
    }
    const [d, m, y] = deleteDate.split('/').map(Number)
    if (!d || !m || !y) {
      setDeleteError('Invalid date format.')
      return
    }
    const iso = `${y}-${pad(m)}-${pad(d)}`
    setLoadingS(true)
    const { data, error } = await supabase
      .from('prayer_logs')
      .select('id, total_seconds, memory_note, logged_at')
      .eq('user_id', user.id)
      .eq('prayer_date', iso)
      .order('logged_at', { ascending: true })
    setLoadingS(false)
    if (error) {
      setDeleteError(error.message)
      return
    }
    if (!data.length) {
      setDeleteError('No sessions found for that date.')
      return
    }
    setSessions(data)
  }

  async function deleteSession(id) {
    setDeletingId(id)
    const { error } = await supabase
      .from('prayer_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) {
      setSessions(prev => prev.filter(s => s.id !== id))
    }
    setDeletingId(null)
  }

  function resetDelete() {
    setShowDelete(false)
    setDeleteDate('')
    setDeletePass('')
    setDeleteError('')
    setSessions(null)
  }

  return (
    <div className="h-full flex flex-col safe-top">
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-cream">Settings</h1>
      </div>

      <div className="flex-1 scroll-area px-6 pb-6 space-y-4">
        {/* Account */}
        <div className="glass-sm px-5 py-4">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Account</p>
          <p className="text-cream text-sm font-medium">{user.email}</p>
          <button
            onClick={signOut}
            className="mt-4 btn-ghost w-full text-center text-sm py-3"
          >
            Sign Out
          </button>
        </div>

        {/* WhatsApp */}
        <div className="glass-sm px-5 py-5 space-y-4">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">WhatsApp Group</p>
          <p className="text-white/40 text-xs leading-relaxed">
            Enter a phone number (with country code) or a WhatsApp group invite link.
            This is used when you tap "Share to WhatsApp" after logging.
          </p>
          <input
            type="text"
            className="input-glass"
            placeholder="+919876543210 or https://chat.whatsapp.com/..."
            value={whatsappGroup}
            onChange={e => setWhatsappGroup(e.target.value)}
          />
          <button
            onClick={saveWhatsApp}
            disabled={saving}
            className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95 ${
              saved
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'btn-amber'
            }`}
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </button>
        </div>

        {/* Emergency Delete */}
        <div className="glass-sm px-5 py-5 space-y-3">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Emergency Delete</p>
          <p className="text-white/35 text-xs leading-relaxed">
            Find sessions by date and delete individually. Requires password. Cannot be undone.
          </p>

          {!showDelete ? (
            <button
              onClick={() => setShowDelete(true)}
              className="btn-ghost w-full text-center text-sm py-3 text-red-400"
              style={{ borderColor: 'rgba(239,68,68,0.2)' }}
            >
              Delete a Session
            </button>
          ) : (
            <div className="space-y-3">
              {!sessions && (
                <>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder="Date (dd/mm/yyyy)"
                    value={deleteDate}
                    onChange={e => setDeleteDate(e.target.value)}
                    maxLength={10}
                  />
                  <input
                    type="password"
                    className="input-glass"
                    placeholder="Password"
                    value={deletePass}
                    onChange={e => setDeletePass(e.target.value)}
                  />
                  {deleteError && (
                    <p className="text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-xl">{deleteError}</p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={resetDelete} className="flex-1 btn-ghost text-center text-sm py-3">
                      Cancel
                    </button>
                    <button
                      onClick={loadSessions}
                      disabled={loadingS}
                      className="flex-1 py-3 rounded-2xl font-semibold text-sm text-amber-400 border border-amber-500/30 bg-amber-500/10 active:scale-95 disabled:opacity-60 transition-all"
                    >
                      {loadingS ? 'Loading...' : 'Find Sessions'}
                    </button>
                  </div>
                </>
              )}

              {sessions && (
                <>
                  <div className="space-y-2">
                    {sessions.length === 0 ? (
                      <p className="text-white/40 text-xs text-center py-2">All sessions deleted.</p>
                    ) : (
                      sessions.map((s, i) => (
                        <div key={s.id} className="flex items-center justify-between glass-sm px-4 py-3">
                          <div>
                            <p className="text-cream text-sm font-semibold">{fmtTime(s.total_seconds)}</p>
                            {s.memory_note && (
                              <p className="text-white/35 text-xs mt-0.5 truncate max-w-[160px]">{s.memory_note}</p>
                            )}
                            <p className="text-white/25 text-xs mt-0.5">
                              Session {i + 1} · {new Date(s.logged_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <button
                            onClick={() => deleteSession(s.id)}
                            disabled={deletingId === s.id}
                            className="ml-3 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 border border-red-500/30 bg-red-500/10 active:scale-95 disabled:opacity-60 transition-all"
                          >
                            {deletingId === s.id ? '...' : 'Delete'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <button onClick={resetDelete} className="btn-ghost w-full text-center text-sm py-3">
                    Done
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* App info */}
        <div className="px-2 py-3 text-center">
          <p className="text-white/20 text-xs">Tongues Prayer Logger · v1.0</p>
          <p className="text-white/15 text-xs mt-0.5">All data is permanent and private</p>
        </div>
      </div>
    </div>
  )
}
