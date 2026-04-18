import React, { useState, useEffect } from 'react'
import { ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AUTH_BASE } from '../config'

interface LoginProps {
  onLogin: (role: any, name: string) => void
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [message, setMessage] = useState(location.state?.message || '')

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

  const handleGoogleLogin = () => {
    // Redirect to backend OAuth route
    window.location.href = AUTH_BASE
  }

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
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 py-4 px-4 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm group"
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
          </button>

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
