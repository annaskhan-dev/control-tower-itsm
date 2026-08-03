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
      // Use axiosInstance.post with the correct key 'password'
      const res = await axiosInstance.post('/auth/register', { 
          name: formData.name, 
          email: formData.email, 
          password: formData.password, // Corrected from 'pass' to 'password'
          companyId: formData.companyId,
          role: formData.role 
      });

      alert('Registration Successful!');
      navigate('/login');
      
    } catch (err) {
      // Axios error response is inside err.response
      const errorMsg = err.response?.data?.message || 'Registration failed.';
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-blue-950 p-2 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[280px] max-h-full flex flex-col justify-center"
      >
        <div className="flex flex-col items-center mb-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
            <TowerControl size={14} className="text-white" />
          </div>
          <h1 className="text-xs font-bold text-white mt-1">Create Account</h1>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl shrink-0">
          <form onSubmit={handleRegister} className="flex flex-col gap-1.5">
            {[
              { icon: User, label: 'Full Name', key: 'name', type: 'text' },
              { icon: Mail, label: 'Email', key: 'email', type: 'email' },
              { icon: Lock, label: 'Password', key: 'password', type: 'password' },
              { icon: Building, label: 'Company ID', key: 'companyId', type: 'text' },
            ].map((field) => (
              <div key={field.key} className="flex items-center bg-black/20 rounded-md border border-white/10">
                <field.icon className="ml-2 text-gray-500" size={10} />
                <input 
                  className="w-full bg-transparent p-1.5 text-white text-[9px] outline-none"
                  type={field.type}
                  placeholder={field.label}
                  value={formData[field.key]}
                  onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
                  required
                />
              </div>
            ))}

            <div className="flex items-center bg-black/20 rounded-md border border-white/10">
              <ShieldCheck className="ml-2 text-gray-500" size={10} />
              <select 
                className="w-full bg-transparent p-1.5 text-white outline-none text-[9px] cursor-pointer"
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                required
                value={formData.role}
              >
                <option value="" disabled className="text-black">Select Role</option>
                <option value="Operator" className="text-black">Operator</option>
                <option value="Manager" className="text-black">Manager</option>
                <option value="Super Admin" className="text-black">Super Admin</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-1.5 rounded-md text-[9px] transition-all"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" size={12} /> : 'REGISTER'}
            </button>
            
            <p className="text-center text-[8px] text-gray-400">
              Already have an account? <Link to="/login" className="text-purple-400 font-bold">Login</Link>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
};