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
    <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-blue-950 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md" // Increased width from max-w-xs to max-w-md
      >
        {/* Header - Scaled up */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center shadow-lg mb-3">
            <TowerControl size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Control Tower</h1>
        </div>

        {/* Login Card - More breathing room */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            <div className="flex items-center bg-black/20 rounded-xl border border-white/10 focus-within:border-purple-500/50 transition-all px-2">
              <Mail className="ml-2 text-gray-400" size={20} />
              <input 
                className="w-full bg-transparent p-3 text-white text-base outline-none"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center bg-black/20 rounded-xl border border-white/10 focus-within:border-purple-500/50 transition-all px-2">
              <Lock className="ml-2 text-gray-400" size={20} />
              <input 
                className="w-full bg-transparent p-3 text-white text-base outline-none"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button 
              type="submit" 
              className="mt-2 w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl text-base transition-all shadow-lg shadow-purple-600/30"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" size={22} /> : 'LOGIN'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Don't have an account? <Link to="/register" className="text-purple-400 font-bold hover:underline">Register</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};