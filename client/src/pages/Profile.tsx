import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Target, Clock, Settings, LogOut, Award, Zap, Palette, MessageCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import { getRankByLevel, getNextRank, getRankProgress, formatPlayTime, calculateWinRate } from '../utils/ranks';
import type { PlayerStats, MatchHistory } from '../types';

import './Profile.css';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const rank = getRankByLevel(user?.level || 1);
  const nextRank = getNextRank(user?.level || 1);
  const rankProgress = getRankProgress(user?.level || 1, user?.xp || 0);
  const xpToNextLevel = (user?.level || 1) * 500;
  const currentXp = (user?.xp || 0) % xpToNextLevel;

  useEffect(() => {
    fetchProfileData();
  }, [user?.id]);

  const fetchProfileData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      const [statsRes, historyRes] = await Promise.all([
        fetch(`/api/users/${user.id}/stats`),
        fetch(`/api/users/${user.id}/history`)
      ]);
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }
      
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setMatchHistory(historyData.history);
      }
    } catch (error) {
      console.error('Failed to fetch profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const achievements = [
    { id: 1, name: 'First Win', icon: '🏆', unlocked: (stats?.gamesWon || 0) >= 1 },
    { id: 2, name: 'Veteran', icon: '🎮', unlocked: (stats?.gamesPlayed || 0) >= 100 },
    { id: 3, name: 'Speed Demon', icon: '⚡', unlocked: false },
    { id: 4, name: 'Master Artist', icon: '🎨', unlocked: (stats?.wordsDrawn || 0) >= 50 },
    { id: 5, name: 'Word Wizard', icon: '🤔', unlocked: (stats?.wordsGuessed || 0) >= 100 },
    { id: 6, name: 'On Fire', icon: '🔥', unlocked: (stats?.bestStreak || 0) >= 5 },
    { id: 7, name: 'GOAT Status', icon: '👑', unlocked: (user?.level || 0) >= 500 },
  ];

  const winRate = calculateWinRate(stats?.gamesWon || 0, stats?.gamesPlayed || 0);

  return (
    <div className="profile-page">

      {/* Header */}
      <header className="profile-header">
        <Button variant="ghost" size="sm" onClick={() => navigate('/lobby')}>
          <ArrowLeft size={20} />
        </Button>
        <h1>Profile</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
            <Settings size={20} />
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut size={20} />
          </Button>
        </div>
      </header>

      <main className="profile-main">
        {/* Profile Card */}
        <motion.div 
          className="profile-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="avatar-section">
            <div className="avatar-large" style={{ borderColor: rank.color }}>
              {user?.avatarId || '👤'}
              <div className="rank-badge-large" style={{ background: rank.color }}>
                {rank.icon}
              </div>
            </div>
            <h2>{user?.username || 'Guest'}</h2>
            <div className="rank-display" style={{ color: rank.color }}>
              <span>{rank.icon}</span>
              <span>{rank.name}</span>
            </div>
          </div>
          
          {/* XP Progress */}
          <div style={{ 
            background: 'rgba(255,255,255,0.05)', 
            borderRadius: '16px', 
            padding: '16px',
            marginTop: '16px'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '8px',
              fontSize: '0.9rem'
            }}>
              <span>Level {user?.level || 1}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{currentXp}/{xpToNextLevel} XP</span>
            </div>
            <div style={{ 
              height: '8px', 
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${rankProgress.percentage}%`,
                background: `linear-gradient(90deg, ${rank.color}, ${nextRank?.color || rank.color})`,
                borderRadius: '4px',
                transition: 'width 0.3s'
              }}></div>
            </div>
            {nextRank && (
              <div style={{ 
                fontSize: '0.8rem', 
                color: 'rgba(255,255,255,0.5)', 
                marginTop: '8px',
                textAlign: 'center'
              }}>
                Next: {nextRank.name}
              </div>
            )}
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <motion.div 
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Trophy className="stat-icon" size={24} />
            <div className="stat-value">{stats?.gamesPlayed || 0}</div>
            <div className="stat-label">Games</div>
          </motion.div>
          
          <motion.div 
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Target className="stat-icon" size={24} />
            <div className="stat-value">{winRate}%</div>
            <div className="stat-label">Win Rate</div>
          </motion.div>
          
          <motion.div 
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Palette className="stat-icon" size={24} />
            <div className="stat-value">{stats?.wordsDrawn || 0}</div>
            <div className="stat-label">Drawn</div>
          </motion.div>
          
          <motion.div 
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <MessageCircle className="stat-icon" size={24} />
            <div className="stat-value">{stats?.wordsGuessed || 0}</div>
            <div className="stat-label">Guessed</div>
          </motion.div>
        </div>

        {/* Quick Stats Row */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '24px',
          padding: '0 16px 16px',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.85rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} />
            <span>{stats?.bestStreak || 0} Best Streak</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} />
            <span>{formatPlayTime(stats?.totalPlayTime || 0)}</span>
          </div>
        </div>

        {/* Achievements */}
        <motion.div 
          className="achievements-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3><Award size={20} /> Achievements</h3>
          <div className="achievements-grid">
            {achievements.map((achievement) => (
              <div 
                key={achievement.id} 
                className={`achievement-card ${achievement.unlocked ? 'unlocked' : ''}`}
              >
                <span className="achievement-icon">{achievement.icon}</span>
                <span className="achievement-name">{achievement.name}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Match History */}
        <motion.div 
          className="history-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          style={{ padding: '16px' }}
        >
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Trophy size={20} /> Recent Matches
          </h3>
          
          {matchHistory.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px',
              color: 'rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '16px'
            }}>
              <p style={{ marginBottom: '16px' }}>No matches played yet</p>
              <Button variant="primary" size="sm" onClick={() => navigate('/lobby')}>
                Play Now
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {matchHistory.slice(0, 5).map((match, index) => (
                <div 
                  key={match.id || index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ 
                    fontSize: '1.25rem',
                    color: match.placement === 1 ? '#00F5A0' : 'rgba(255,255,255,0.5)',
                    fontWeight: 700,
                    minWidth: '40px'
                  }}>
                    #{match.placement}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{match.roomName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                      {new Date(match.playedAt).toLocaleDateString()} • {match.players} players
                    </div>
                  </div>
                  <div style={{ 
                    color: '#00F5D4',
                    fontWeight: 700,
                    fontSize: '0.9rem'
                  }}>
                    +{match.xpGained} XP
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
