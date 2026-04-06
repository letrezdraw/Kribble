import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Users, Zap, Shield, Palette, Trophy, Sparkles, Star } from 'lucide-react';
import Button from '../components/Button';
import './Landing.css';

// Floating particle component
function FloatingParticles() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 3 + Math.random() * 6,
    duration: 12 + Math.random() * 18,
    delay: Math.random() * 8,
    hue: Math.random() > 0.5 ? '139, 92, 246' : '6, 182, 212',
    opacity: 0.15 + Math.random() * 0.3,
  }));

  return (
    <div className="floating-particles">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            background: `rgba(${p.hue}, ${p.opacity})`,
          }}
          animate={{
            y: [0, -800],
            opacity: [0, p.opacity, p.opacity, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

// Animated canvas preview showing a drawing being created
function AnimatedCanvasPreview() {
  return (
    <div className="game-preview">
      <div className="preview-canvas">
        <div className="preview-drawing">
          {/* Animated SVG drawing */}
          <svg viewBox="0 0 400 200" className="preview-svg">
            {/* Star shape being drawn */}
            <motion.path
              d="M200 30 L220 75 L270 80 L230 115 L240 165 L200 140 L160 165 L170 115 L130 80 L180 75 Z"
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                pathLength: { duration: 3, ease: 'easeInOut', repeat: Infinity, repeatDelay: 4 },
                opacity: { duration: 0.5 },
              }}
            />
            {/* Fill animation */}
            <motion.path
              d="M200 30 L220 75 L270 80 L230 115 L240 165 L200 140 L160 165 L170 115 L130 80 L180 75 Z"
              fill="#8b5cf6"
              opacity={0}
              animate={{ opacity: [0, 0, 0.15, 0.15, 0] }}
              transition={{ duration: 7, repeat: Infinity }}
            />
            {/* Brush cursor */}
            <motion.circle
              r="4"
              fill="#8b5cf6"
              animate={{
                cx: [200, 220, 270, 230, 240, 200, 160, 170, 130, 180, 200],
                cy: [30, 75, 80, 115, 165, 140, 165, 115, 80, 75, 30],
              }}
              transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity, repeatDelay: 4 }}
            />
          </svg>
          {/* Tool indicator */}
          <div className="preview-tool-indicator">
            <Palette size={14} />
            <span>Drawing...</span>
          </div>
        </div>
        <div className="preview-chat">
          <motion.div
            className="chat-message"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.5, duration: 0.4 }}
          >
            <span className="chat-user">Player1:</span> is it a star? ⭐
          </motion.div>
          <motion.div
            className="chat-message correct"
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ delay: 3, duration: 0.4 }}
          >
            <span className="chat-user">Player2:</span> guessed correctly! 🎉
          </motion.div>
        </div>
      </div>
      {/* Floating badges around the preview */}
      <motion.div
        className="preview-badge badge-players"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <Users size={14} /> 4 Players
      </motion.div>
      <motion.div
        className="preview-badge badge-score"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
      >
        <Trophy size={14} /> +150 pts
      </motion.div>
    </div>
  );
}

// Stats counter component
function StatsCounter({ value, label }: { value: string; label: string }) {
  return (
    <motion.div
      className="stat-counter"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </motion.div>
  );
}

export default function Landing() {
  const features = [
    {
      icon: Palette,
      title: 'Pro Drawing Tools',
      description: 'Brushes, shapes, fill tool, opacity control, and more for creative masterpieces',
      gradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
    },
    {
      icon: Users,
      title: 'Real-time Multiplayer',
      description: 'Play with friends or join public rooms worldwide — up to 16 players',
      gradient: 'linear-gradient(135deg, #06b6d4, #67e8f9)',
    },
    {
      icon: Zap,
      title: 'Instant Sync',
      description: 'Sub-50ms drawing synchronization with reconnection support',
      gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    },
    {
      icon: Shield,
      title: 'Fair & Fun',
      description: 'Anti-cheat word system, profanity filter, and balanced scoring',
      gradient: 'linear-gradient(135deg, #10b981, #34d399)',
    },
    {
      icon: Trophy,
      title: 'Ranked Play',
      description: 'XP, levels, leaderboards — compete to be the best artist & guesser',
      gradient: 'linear-gradient(135deg, #ec4899, #f472b6)',
    },
    {
      icon: Star,
      title: 'Customizable',
      description: 'Rounds, time limits, hints, word packs — configure your perfect game',
      gradient: 'linear-gradient(135deg, #f97316, #fb923c)',
    },
  ];

  return (
    <div className="landing">
      {/* Animated Background */}
      <div className="landing-bg">
        <div className="bg-gradient" />
        <div className="bg-grid" />
        <div className="bg-glow glow-1" />
        <div className="bg-glow glow-2" />
        <div className="bg-glow glow-3" />
        <FloatingParticles />
      </div>

      {/* Header */}
      <header className="landing-header">
        <div className="logo">
          <span className="logo-icon">🎨</span>
          <span className="logo-text">Kribble</span>
        </div>
        <div className="header-actions">
          <Link to="/login">
            <Button variant="secondary" size="md">Sign In</Button>
          </Link>
          <Link to="/login">
            <Button variant="primary" size="md">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="hero-badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <Sparkles size={14} />
            <span>Free to play • No download required</span>
          </motion.div>
          <h1 className="hero-title">
            Draw. Guess.{' '}
            <span className="highlight">Win!</span>
          </h1>
          <p className="hero-subtitle">
            The ultimate multiplayer drawing and guessing game.
            Challenge your friends, showcase your artistic skills,
            and guess your way to victory!
          </p>
          <div className="hero-buttons">
            <Link to="/login">
              <Button variant="primary" size="lg">
                <Play size={20} />
                Play Now
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" size="lg">
                <Users size={20} />
                Join Room
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, scale: 0.85, rotateY: -5 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <AnimatedCanvasPreview />
        </motion.div>
      </section>

      {/* Social Proof Stats */}
      <section className="stats-section">
        <StatsCounter value="1000+" label="Games Played" />
        <StatsCounter value="500+" label="Active Players" />
        <StatsCounter value="50+" label="Word Categories" />
        <StatsCounter value="99.9%" label="Uptime" />
      </section>

      {/* Features Section */}
      <section className="features">
        <motion.div
          className="section-header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="section-title">Why Kribble?</h2>
          <p className="section-subtitle">Everything you need for the perfect drawing game experience</p>
        </motion.div>
        <div className="features-grid">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
            >
              <div className="feature-icon" style={{ background: feature.gradient }}>
                <feature.icon size={24} />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <motion.div
          className="cta-content"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2>Ready to Draw?</h2>
          <p>Jump in — no signup required. Play as a guest instantly!</p>
          <Link to="/login">
            <Button variant="primary" size="lg">
              <Sparkles size={20} />
              Start Playing Now
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <p>© 2026 Kribble. All rights reserved.</p>
          <div className="footer-links">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/contact">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
