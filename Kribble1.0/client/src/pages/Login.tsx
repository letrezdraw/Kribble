import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  EyeOff, 
  X, 
  Sparkles,
  Palette,
  Users,
  User,
  Zap,
  Gamepad2,
  ArrowRight
} from 'lucide-react';


import { useAuth } from '../contexts/AuthContext';

import Button from '../components/Button';
import './Login.css';

// Floating animation component
const FloatingElement = ({ 
  children, 
  delay = 0, 
  duration = 3,
  yOffset = 20
}: { 
  children: React.ReactNode; 
  delay?: number;
  duration?: number;
  yOffset?: number;
}) => (
  <motion.div
    animate={{
      y: [0, -yOffset, 0],
    }}
    transition={{
      duration,
      repeat: Infinity,
      ease: "easeInOut",
      delay,
    }}
  >
    {children}
  </motion.div>
);

// Particle background component
const ParticleBackground = () => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 2,
  }));

  return (
    <div className="particle-container">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="particle"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            opacity: [0.2, 0.8, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

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

  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestUsername, setGuestUsername] = useState('');

  // Clear error when switching modes
  useEffect(() => {
    setError('');
  }, [isLogin]);

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
      const message = err.response?.data?.message || 'An error occurred';
      if (isLogin && message === 'Invalid credentials') {
        setError('Invalid credentials. Need an account? Click "Create Account" below.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
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
    <div className="login-page">
      <ParticleBackground />
      
      {/* Left Side - Hero Section */}
      <div className="login-hero">
        <div className="hero-content">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <FloatingElement delay={0} duration={4} yOffset={15}>
              <div className="hero-icon">
                <Palette size={64} />
              </div>
            </FloatingElement>
            
            <h1 className="hero-title">
              <span className="gradient-text">Draw.</span>
              <span className="gradient-text-alt"> Guess.</span>
              <span className="gradient-text"> Win!</span>
            </h1>
            
            <p className="hero-subtitle">
              Join thousands of players in the most addictive drawing game. 
              Sketch, guess, and compete in real-time!
            </p>
          </motion.div>

          <motion.div 
            className="hero-features"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            <FloatingElement delay={0.2} duration={3.5} yOffset={10}>
              <div className="feature-card">
                <Users className="feature-icon" size={24} />
                <span>Multiplayer</span>
              </div>
            </FloatingElement>
            
            <FloatingElement delay={0.4} duration={3.2} yOffset={12}>
              <div className="feature-card">
                <Zap className="feature-icon" size={24} />
                <span>Real-time</span>
              </div>
            </FloatingElement>
            
            <FloatingElement delay={0.6} duration={3.8} yOffset={8}>
              <div className="feature-card">
                <Gamepad2 className="feature-icon" size={24} />
                <span>Fun & Free</span>
              </div>
            </FloatingElement>
          </motion.div>
        </div>

        {/* Animated background shapes */}
        <div className="hero-shapes">
          <motion.div 
            className="shape shape-1"
            animate={{ 
              rotate: 360,
              scale: [1, 1.2, 1],
            }}
            transition={{ 
              rotate: { duration: 20, repeat: Infinity, ease: "linear" },
              scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
          />
          <motion.div 
            className="shape shape-2"
            animate={{ 
              rotate: -360,
              x: [0, 50, 0],
            }}
            transition={{ 
              rotate: { duration: 25, repeat: Infinity, ease: "linear" },
              x: { duration: 6, repeat: Infinity, ease: "easeInOut" }
            }}
          />
          <motion.div 
            className="shape shape-3"
            animate={{ 
              y: [0, -30, 0],
              rotate: [0, 180, 360],
            }}
            transition={{ 
              duration: 8, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          />
        </div>
      </div>

      {/* Right Side - Form Section */}
      <div className="login-form-section">
        <motion.div
          className="login-container"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="login-header">
            <Link to="/" className="logo">
              <motion.span 
                className="logo-icon"
                whileHover={{ scale: 1.1, rotate: 10 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                🎨
              </motion.span>
              <span className="logo-text">Kribble</span>
            </Link>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? 'login' : 'register'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <h1>{isLogin ? 'Welcome Back!' : 'Create Account'}</h1>
                <p>{isLogin ? 'Sign in to continue your journey' : 'Join the fun and start drawing!'}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  className="form-group"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                <label htmlFor="username">Username</label>
                  <div className="input-wrapper">
                    <input

                      type="text"
                      id="username"
                      name="username"
                      placeholder="Enter your username"
                      value={formData.username}
                      onChange={handleChange}
                      required={!isLogin}
                      autoComplete="username"
                    />
                  </div>

                </motion.div>
              )}
            </AnimatePresence>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <div className="input-wrapper">
                <input

                  type="email"
                  id="email"
                  name="email"
                  placeholder="Enter your email"
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
                <input

                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder="Enter your password"
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

            <AnimatePresence>
              {error && (
                <motion.div 
                  className="error-message"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="error-icon">⚠️</span>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                type="submit" 
                variant="primary" 
                size="lg" 
                loading={loading}
                fullWidth
              >
                {isLogin ? 'Sign In' : 'Create Account'}
                <ArrowRight size={20} style={{ marginLeft: '8px' }} />
              </Button>
            </motion.div>

            <div className="divider">
              <span>or continue with</span>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                type="button" 
                variant="secondary" 
                size="lg" 
                onClick={handleGuestLogin}
                fullWidth
                className="guest-button"
              >
                <Sparkles size={20} />
                Play as Guest
              </Button>
            </motion.div>
            
            <p className="guest-hint">
              ⚡ No registration required • Data expires in 24h
            </p>
          </form>

          <div className="login-footer">
            <p>
              {isLogin ? "New to Kribble? " : 'Already have an account? '}
              <motion.button 
                type="button"
                onClick={() => setIsLogin(!isLogin)} 
                className="link-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isLogin ? 'Create Account' : 'Sign In'}
              </motion.button>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Guest Username Modal */}
      <AnimatePresence>
        {showGuestModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseGuestModal}
          >
            <motion.div
              className="modal-content guest-modal"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-icon">
                  <Sparkles size={28} />
                </div>
                <h3>Quick Play</h3>
                <button className="close-btn" onClick={handleCloseGuestModal}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="modal-body">
                <p className="modal-description">
                  Enter a fun username or leave blank for a random one!
                </p>
                
                <div className="form-group">
                  <div className="input-wrapper">
                    <User className="input-icon" size={20} />
                    <input
                      type="text"
                      placeholder="YourAwesomeName"
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
                  <span className="char-count">{guestUsername.length}/20</span>
                </div>
              </div>
              
              <div className="modal-footer">
                <Button 
                  variant="ghost" 
                  onClick={handleCloseGuestModal}
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
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
    </div>
  );
}
