import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Users, Zap, Shield, Palette, Trophy, Sparkles } from 'lucide-react';
import Button from '../../components/Button';
import './LandingMobile.css';



export default function LandingMobile() {
  const features = [
    { icon: Palette, title: 'Draw', desc: 'Express creativity' },
    { icon: Users, title: 'Play', desc: 'With friends' },
    { icon: Zap, title: 'Sync', desc: 'Real-time' },
    { icon: Trophy, title: 'Win', desc: 'Climb ranks' },
  ];

  return (
    <div className="landing-mobile">
      {/* Compact Hero */}
      <section className="hero-compact">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ duration: 0.4 }}
          className="hero-content"
        >
          <div className="logo-row">
            <span className="logo-emoji">🎨</span>
            <span className="logo-text">Kribble</span>
            <Sparkles size={16} className="sparkle-icon" />
          </div>
          
          <h1 className="hero-tagline">
            Draw. Guess. <span className="highlight">Win!</span>
          </h1>
          
          <p className="hero-desc">Play with friends anywhere</p>
          
          <Link to="/login" className="cta-button">
            <Button variant="primary" size="lg" fullWidth>
              <Play size={18} /> Play Now
            </Button>
          </Link>
          
          <div className="quick-stats">
            <span>🎮 Free</span>
            <span>⚡ Real-time</span>
            <span>🌍 Multiplayer</span>
          </div>
        </motion.div>
      </section>

      {/* Compact Features - Horizontal Scroll */}
      <section className="features-compact">
        <div className="features-scroll">
          {features.map((f, i) => (
            <motion.div 
              key={i} 
              className="feature-pill"
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ delay: i * 0.1 }}
            >
              <div className="pill-icon"><f.icon size={18} /></div>
              <div className="pill-text">
                <strong>{f.title}</strong>
                <span>{f.desc}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Bottom Action */}
      <footer className="landing-footer-compact">
        <Link to="/login" className="footer-cta">
          <Button variant="secondary" size="md" fullWidth>
            <Users size={16} /> Join Room
          </Button>
        </Link>
        <p className="copyright">© 2024 Kribble</p>
      </footer>
    </div>
  );
}
