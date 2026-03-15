
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { UserRole, User } from '../types';
import { api } from '../services/api';
import { AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const role: UserRole = 'student';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState('');
  const setUser = useStore(state => state.setUser);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Client-side validation
    if (isRegister && !fullName.trim()) {
      setError('Full name is required.');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      if (isRegister) {
        await api.register(email, password, fullName.trim());
        // Registration successful — switch to sign-in form
        setSuccess('Account created! Please sign in with your credentials.');
        setIsRegister(false);
        setFullName('');
        setPassword('');
      } else {
        const res = await api.login(email, password);
        const user: User = {
          id: res.user.id,
          name: res.user.full_name || email.split('@')[0],
          email: res.user.email,
          role,
        };
        setUser(user, res.access_token, res.refresh_token);
        navigate('/dashboard');
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || (isRegister ? 'Registration failed. Please try again.' : 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/dark-wood.png')]">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-10 space-y-8 animate-in zoom-in-95 duration-300">
        <div className="text-center">
          <div className="w-16 h-16 bg-teal-500 rounded-2xl mx-auto flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-teal-500/30 mb-4">P</div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">PelicanEye</h1>
          <p className="text-slate-500 mt-2 font-medium">Coastal Conservation Monitoring</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {success && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
              ✓ {success}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="space-y-4">
            {isRegister && (
              <input
                type="text"
                placeholder="Full Name"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            )}
            <input 
              type="email" 
              required
              placeholder="Email address" 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input 
              type="password"
              required
              placeholder="Password" 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/20 active:scale-[0.98]"
          >
            {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="text-center text-sm text-slate-400">
          <button onClick={() => setIsRegister(!isRegister)} className="text-teal-600 font-semibold hover:underline">
            {isRegister ? 'Already have an account? Sign In' : 'Need an account? Register'}
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-300 pt-2 border-t border-slate-100">
          © {new Date().getFullYear()} PelicanEye · CoastWatch AI. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
