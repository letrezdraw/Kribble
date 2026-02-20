import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Users, Zap, Shield, Palette, Trophy } from 'lucide-react';
import Button from '../components/Button';
import './Landing.css';

export default function Landing() {
  const features = [
    {
      icon: Palette,
      title: 'Drawing Tools',
      description: 'Multiple brush types, shapes, colors, and effects for creative expression',
    },
    {
      icon: Users,
      title: 'Multiplayer',
      description: 'Play with friends or join rooms with players worldwide',
    },
    {
      icon: Zap,
      title: 'Real-time Sync',
      description: 'Lightning-fast drawing synchronization across all devices',
    },
    {
      icon: Shield,
      title: 'Fair Play',
      description: 'Smart word selection and anti-cheat systems',
    },
    {
      icon: Trophy,
      title: 'Ranked Matches',
      description: 'Compete in ranked games and climb the leaderboards',
    },
    {
      icon: Users,
      title: 'Profiles & Stats',
      description: 'Track your progress, unlock achievements, and show off your skills',
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
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="hero-title">
            Draw. Guess. <span className="highlight">Win!</span>
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
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="game-preview">
            <div className="preview-canvas">
              <div className="preview-drawing">
                <div className="draw-line" />
                <div className="draw-line draw-line-2" />
              </div>
              <div className="preview-chat">
                <div className="chat-message">
                  <span className="chat-user">Player1:</span> is it a cat?
                </div>
                <div className="chat-message correct">
                  <span className="chat-user">Player2:</span> guessed correctly! 🎉
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="features">
        <motion.h2
          className="section-title"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Why Kribble?
        </motion.h2>
        <div className="features-grid">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="feature-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="feature-icon">
                <feature.icon size={24} />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <p>© 2024 Kribble. All rights reserved.</p>
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
