import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles } from 'lucide-react';

import Button from '../components/Button';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, register, guest } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [guestLoading, setGuestLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData.username, formData.email, formData.password);
      }
      navigate('/lobby');
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGuestLogin = async () => {
    setError('');
    setGuestLoading(true);
    try {
      await guest();
      navigate('/lobby');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create guest account');
    } finally {
      setGuestLoading(false);
    }
  };


  return (
    <div className="login-page">

      <motion.div
        className="login-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="login-header">
          <Link to="/" className="logo">
            <span className="logo-icon">🎨</span>
            <span className="logo-text">Kribble</span>
          </Link>
          <h1>{isLogin ? 'Welcome Back!' : 'Create Account'}</h1>
          <p>{isLogin ? 'Sign in to continue' : 'Join and start playing'}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div className="input-wrapper">
                <User className="input-icon" size={20} />
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Enter username"
                  value={formData.username}
                  onChange={handleChange}
                  required={!isLogin}
                  autoComplete="username"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={20} />
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Enter email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <Button type="submit" variant="primary" size="lg" loading={loading}>
            {isLogin ? 'Sign In' : 'Create Account'}
          </Button>

          <div className="divider">
            <span>or</span>
          </div>

          <Button 
            type="button" 
            variant="secondary" 
            size="lg" 
            loading={guestLoading}
            onClick={handleGuestLogin}
            className="guest-button"
          >
            <Sparkles size={18} />
            Play as Guest
          </Button>
          
          <p className="guest-hint">⚡ Quick play - no registration needed. Data expires in 24 hours.</p>
        </form>

        <div className="login-footer">

          <p>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)} 
              className="link-button"
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
