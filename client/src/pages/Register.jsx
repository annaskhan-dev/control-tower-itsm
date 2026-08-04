import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, TowerControl, Building, Loader2, ShieldCheck } from 'lucide-react';
// Import your axiosInstance
import axiosInstance from '../api/axiosInstance'; 

export const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', companyId: '', role: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axiosInstance.post('/auth/register', { 
          name: formData.name, 
          email: formData.email, 
          password: formData.password, 
          companyId: formData.companyId,
          role: formData.role 
      });

      alert('Registration Successful!');
      navigate('/login');
      
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Registration failed.';
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-blue-950 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md" // Increased container width to match login
      >
        {/* Header - Scaled up */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center shadow-lg mb-3">
            <TowerControl size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
        </div>

        {/* Register Card - More breathing room */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            {[
              { icon: User, label: 'Full Name', key: 'name', type: 'text' },
              { icon: Mail, label: 'Email address', key: 'email', type: 'email' },
              { icon: Lock, label: 'Password', key: 'password', type: 'password' },
              { icon: Building, label: 'Company ID', key: 'companyId', type: 'text' },
            ].map((field) => (
              <div key={field.key} className="flex items-center bg-black/20 rounded-xl border border-white/10 focus-within:border-purple-500/50 transition-all px-2">
                <field.icon className="ml-2 text-gray-400" size={20} />
                <input 
                  className="w-full bg-transparent p-3 text-white text-base outline-none"
                  type={field.type}
                  placeholder={field.label}
                  value={formData[field.key]}
                  onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
                  required
                />
              </div>
            ))}

            <div className="flex items-center bg-black/20 rounded-xl border border-white/10 focus-within:border-purple-500/50 transition-all px-2">
              <ShieldCheck className="ml-2 text-gray-400" size={20} />
              <select 
                className="w-full bg-transparent p-3 text-white outline-none text-base cursor-pointer [&>option]:bg-indigo-950"
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                required
                value={formData.role}
              >
                <option value="" disabled>Select Role</option>
                <option value="Operator">Operator</option>
                <option value="Manager">Manager</option>
                <option value="Super Admin">Super Admin</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="mt-2 w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl text-base transition-all shadow-lg shadow-purple-600/30"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" size={22} /> : 'REGISTER'}
            </button>
            
            <p className="mt-4 text-center text-sm text-gray-400">
              Already have an account? <Link to="/login" className="text-purple-400 font-bold hover:underline">Login</Link>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
};