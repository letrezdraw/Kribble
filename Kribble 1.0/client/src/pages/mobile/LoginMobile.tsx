import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/Button';
import './LoginMobile.css';




export default function LoginMobile() {
  const navigate = useNavigate();
  const { login, register, guest } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  
  // Guest login state
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestUsername, setGuestUsername] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);


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

  const handleGuestLogin = () => {
    setShowGuestModal(true);
  };

  const handleGuestSubmit = async () => {
    setError('');
    setGuestLoading(true);
    try {
      await guest(guestUsername.trim() || undefined);
      navigate('/lobby');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create guest account');
    } finally {
      setGuestLoading(false);
      setShowGuestModal(false);
      setGuestUsername('');
    }
  };

  const handleCloseGuestModal = () => {
    setShowGuestModal(false);
    setGuestUsername('');
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

          {/* Divider */}
          <div className="divider-compact">
            <span>or</span>
          </div>

          {/* Guest Login */}
          <Button 
            type="button" 
            variant="secondary" 
            size="lg" 
            fullWidth
            onClick={handleGuestLogin}
          >
            <Sparkles size={18} />
            Play as Guest
          </Button>
          <p className="guest-hint-compact">⚡ Quick play - no registration needed</p>
        </form>

        {/* Quick Actions */}
        <div className="quick-actions">
          {isLogin && (
            <button className="text-link">Forgot password?</button>
          )}
        </div>

        {/* Guest Username Modal */}
        <AnimatePresence>
          {showGuestModal && (
            <motion.div
              className="modal-overlay-compact"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseGuestModal}
            >
              <motion.div
                className="modal-content-compact"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header-compact">
                  <h3>Choose Your Guest Name</h3>
                  <button className="close-btn-compact" onClick={handleCloseGuestModal}>
                    <X size={20} />
                  </button>
                </div>
                
                <div className="modal-body-compact">
                  <p className="modal-description-compact">
                    Enter a username or leave blank for a random name.
                  </p>
                  
                  <div className="input-compact">
                    <User size={18} className="input-icon-compact" />
                    <input
                      type="text"
                      placeholder="GuestUsername"
                      value={guestUsername}
                      onChange={(e) => setGuestUsername(e.target.value)}
                      maxLength={20}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleGuestSubmit();
                        }
                      }}
                    />
                  </div>
                  <span className="char-count-compact">{guestUsername.length}/20</span>
                </div>
                
                <div className="modal-footer-compact">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleCloseGuestModal}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="primary" 
                    size="sm"
                    loading={guestLoading}
                    onClick={handleGuestSubmit}
                  >
                    Start Playing
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>

      {/* Bottom Info */}
      <footer className="login-footer-compact">
        <p>By continuing, you agree to our Terms & Privacy</p>
      </footer>
    </div>
  );
}
