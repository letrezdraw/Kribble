import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/Button';
import './LoginMobile.css';



export default function LoginMobile() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({ username: '', email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) await login(formData.email, formData.password);
      else await register(formData.username, formData.email, formData.password);
      navigate('/lobby');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-mobile">
      {/* Compact Header */}
      <header className="login-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </button>
        <div className="header-logo">
          <span className="logo-emoji">🎨</span>
          <span className="logo-text">Kribble</span>
        </div>
        <div style={{ width: 40 }} />
      </header>

      <motion.div 
        className="login-container-compact" 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Tab Switcher */}
        <div className="auth-tabs">
          <button 
            className={isLogin ? 'active' : ''} 
            onClick={() => setIsLogin(true)}
          >
            Sign In
          </button>
          <button 
            className={!isLogin ? 'active' : ''} 
            onClick={() => setIsLogin(false)}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="compact-form">
          {/* Username - only for signup */}
          {!isLogin && (
            <div className="input-compact">
              <User size={18} className="input-icon-compact" />
              <input 
                type="text" 
                placeholder="Username" 
                value={formData.username} 
                onChange={(e) => setFormData({...formData, username: e.target.value})} 
                required={!isLogin} 
              />
            </div>
          )}

          {/* Email */}
          <div className="input-compact">
            <Mail size={18} className="input-icon-compact" />
            <input 
              type="email" 
              placeholder="Email" 
              value={formData.email} 
              onChange={(e) => setFormData({...formData, email: e.target.value})} 
              required 
            />
          </div>

          {/* Password */}
          <div className="input-compact">
            <Lock size={18} className="input-icon-compact" />
            <input 
              type={showPassword ? 'text' : 'password'} 
              placeholder="Password" 
              value={formData.password} 
              onChange={(e) => setFormData({...formData, password: e.target.value})} 
              required 
            />
            <button 
              type="button" 
              className="password-toggle-compact" 
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Error */}
          {error && <div className="error-compact">{error}</div>}

          {/* Submit */}
          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            {isLogin ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        {/* Quick Actions */}
        <div className="quick-actions">
          {isLogin && (
            <button className="text-link">Forgot password?</button>
          )}
        </div>
      </motion.div>

      {/* Bottom Info */}
      <footer className="login-footer-compact">
        <p>By continuing, you agree to our Terms & Privacy</p>
      </footer>
    </div>
  );
}
