import React, { useState, useEffect } from 'react'
import { ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AUTH_BASE, API_BASE } from '../config'

interface LoginProps {
  onLogin: (role: any, name: string) => void
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [message, setMessage] = useState(location.state?.message || '')

  const [localUsername, setLocalUsername] = useState('')
  const isDev = import.meta.env.DEV

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_BASE}/auth/local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: localUsername }),
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('userName', data.name || '')
        onLogin(data.role, data.name || '')
        navigate('/dashboard')
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Network error during login')
    }
  }

  useEffect(() => {
    // 1. Check for manual logout messages
    const storedMessage = sessionStorage.getItem('logoutMessage')
    if (storedMessage) {
      setMessage(storedMessage)
      sessionStorage.removeItem('logoutMessage')
    }

    // 2. Check for Google OAuth tokens or errors in the URL
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    const role = params.get('role')
    const name = params.get('name')
    const urlError = params.get('error')

    if (urlError) {
      setError(urlError)
    }

    if (token && role) {
      localStorage.setItem('token', token)
      localStorage.setItem('userName', name || '')
      onLogin(role, name || '')
      navigate('/dashboard')
    }
  }, [location, navigate, onLogin])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-[440px]">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/assets/logo-full.png"
            alt="HarisCo Full Logo"
            className="h-24 object-contain mb-2"
          />
          <h1 className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">Internal Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to manage office assets</p>
        </div>

        {message && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-100 rounded-lg text-sm text-orange-800 flex items-center gap-3 shadow-sm">
            <AlertCircle size={18} className="text-orange-500 flex-shrink-0" />
            <p>{message}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-800 flex items-center gap-3 shadow-sm">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="card !p-8 space-y-6">
          {isDev ? (
            <form onSubmit={handleLocalLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Username / ID
                </label>
                <input
                  type="text"
                  required
                  value={localUsername}
                  onChange={(e) => setLocalUsername(e.target.value)}
                  placeholder="e.g. admin"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                Bypass to Dashboard
                <ArrowRight size={18} />
              </button>
            </form>
          ) : (
            <a
              href={AUTH_BASE}
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 py-4 px-4 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm group text-center no-underline"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/smartlock/google.svg"
                width="20"
                height="20"
                alt="Google"
              />
              Sign in with Google
              <ArrowRight
                size={18}
                className="text-slate-300 group-hover:translate-x-1 transition-transform ml-auto"
              />
            </a>
          )}

          <p className="text-[11px] text-center text-slate-400 px-4">
            Authorized access only. Use your official @harisco.com or authorized Gmail account to
            log in.
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8 flex items-center justify-center gap-2">
          <ShieldCheck size={14} />
          Secured local office system
        </p>
      </div>
    </div>
  )
}
export default Login
