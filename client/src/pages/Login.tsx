import React, { useState } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useNavigate } from 'react-router-dom';

interface LoginProps {
  onLogin: (role: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        // Log the activity
        await fetch(`${API_BASE}/activity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'LOGIN', 
            details: `User logged in: ${email}`,
            performedBy: `${data.role} User`
          }),
        });
        onLogin(data.role);
        navigate('/dashboard');
      } else {
        setError('Invalid email or password.');
      }
    } catch (err) {
      setError('Connection failed. Is the server running?');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-[440px]">
        <div className="flex flex-col items-center mb-8">
          <img src="/assets/logo-full.png" alt="HarisCo Full Logo" className="h-24 object-contain mb-2" />
          <h1 className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">Internal Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to manage office assets</p>
        </div>

        <form onSubmit={handleLogin} className="card !p-8 space-y-8">
          <button type="button" onClick={handleLogin} className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 py-3 px-4 rounded-lg font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/smartlock/google.svg" width="18" height="18" alt="Google" />
            Sign in with @harisco.com
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">or admin access</span>
            </div>
          </div>

          <div className="space-y-4">
            <Input 
              label="Email Address" 
              placeholder="admin@harisco.com" 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error}
            />
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</label>
              </div>
              <input 
                type="password" 
                placeholder="admin123" 
                className="input" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full flex items-center justify-center gap-2 group"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Verifying...' : 'Access Portal'}
              {!isLoggingIn && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
            </Button>
          </div>
        </form>

        <p className="text-center text-xs text-slate-400 mt-8 flex items-center justify-center gap-2">
          <ShieldCheck size={14} />
          Secured local office system
        </p>
      </div>
    </div>
  );
};

export default Login;
