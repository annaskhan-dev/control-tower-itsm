import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Mail, Lock, TowerControl, Loader2 } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      alert("Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // 'h-screen flex items-center justify-center' forces perfect centering
    <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-blue-950 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xs" // 'max-w-xs' makes the form narrower
      >
        {/* Header - Minimalist */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center shadow-lg mb-2">
            <TowerControl size={24} className="text-white" />
          </div>
          <h1 className="text-lg font-bold text-white">Control Tower</h1>
        </div>

        {/* Login Card - Ultra compact */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            
            <div className="flex items-center bg-black/20 rounded-lg border border-white/10 focus-within:border-purple-500/50 transition-all">
              <Mail className="ml-3 text-gray-500" size={16} />
              <input 
                className="w-full bg-transparent p-2 text-white text-sm outline-none"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center bg-black/20 rounded-lg border border-white/10 focus-within:border-purple-500/50 transition-all">
              <Lock className="ml-3 text-gray-500" size={16} />
              <input 
                className="w-full bg-transparent p-2 text-white text-sm outline-none"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button 
              type="submit" 
              className="mt-1 w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg text-sm transition-all"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'LOGIN'}
            </button>
          </form>

          <p className="mt-4 text-center text-[10px] text-gray-400">
            No account? <Link to="/register" className="text-purple-400 font-bold">Register</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};