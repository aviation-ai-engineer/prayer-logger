import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Auth() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await signUp(email, password)
        if (error) throw error
        setMessage('Check your email to confirm your account, then sign in.')
        setMode('signin')
      } else {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      {/* Logo / Header */}
      <div className="mb-10 text-center">
        <div className="w-20 h-20 mx-auto mb-5 rounded-[28px] flex items-center justify-center glass ring-pulse"
          style={{ background: 'linear-gradient(145deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" className="w-10 h-10">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 15" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-cream tracking-tight">Tongues</h1>
        <p className="text-white/40 mt-1 text-sm">Prayer Time Logger</p>
      </div>

      {/* Card */}
      <div className="glass w-full max-w-sm p-6">
        <h2 className="text-xl font-semibold text-cream mb-6">
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </h2>

        {message && (
          <div className="mb-4 p-3 rounded-xl text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-300 bg-red-500/10 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input-glass"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Password</label>
            <input
              type="password"
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="input-glass"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-amber w-full text-center mt-2 disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-indigo-900 border-t-transparent animate-spin" />
                {mode === 'signin' ? 'Signing in…' : 'Creating…'}
              </span>
            ) : (
              mode === 'signin' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <button
          onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}
          className="mt-5 w-full text-center text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
