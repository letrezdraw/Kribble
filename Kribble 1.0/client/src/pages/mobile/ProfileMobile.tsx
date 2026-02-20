import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Target, Clock, Zap, Award, Star, TrendingUp, Calendar, Gamepad2, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/Button';
import { getRankByLevel } from '../../utils/ranks';
import api from '../../services/api';
import './ProfileMobile.css';




interface MatchHistory { id: string; date: string; result: 'win' | 'loss' | 'draw'; score: number; rank: number; totalPlayers: number; gameMode: string; xpEarned: number; }

export default function ProfileMobile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'stats' | 'achievements' | 'history'>('stats');
  const [matchHistory, setMatchHistory] = useState<MatchHistory[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const rank = getRankByLevel(user?.level || 1);

  useEffect(() => {
    fetchMatchHistory();
    fetchAchievements();
  }, []);

  const fetchMatchHistory = async () => {
    try { const res = await api.get('/users/match-history'); setMatchHistory(res.data.matches || []); } catch {}
  };

  const fetchAchievements = async () => {
    try { const res = await api.get('/users/achievements'); setAchievements(res.data.achievements || []); } catch {}
  };


  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const stats = [
    { icon: Trophy, value: (user as any)?.totalScore || 0, label: 'Score', color: '#00F5D4' },
    { icon: Target, value: (user as any)?.gamesPlayed || 0, label: 'Games', color: '#9B5DE5' },
    { icon: Zap, value: `${(user as any)?.winRate || 0}%`, label: 'Win Rate', color: '#00F5A0' },
    { icon: Clock, value: `${Math.floor(((user as any)?.playTime || 0) / 60)}h`, label: 'Play Time', color: '#F15BB5' },
  ];

  return (
    <div className="profile-mobile-compact">
      {/* Sticky Header */}
      <header className="profile-header-compact">
        <button className="icon-btn-compact" onClick={() => navigate('/lobby')}>
          <ArrowLeft size={20} />
        </button>
        <h1>Profile</h1>
        <button className="icon-btn-compact" onClick={() => navigate('/settings')}>
          <Settings size={20} />
        </button>
      </header>

      {/* Compact Hero */}
      <div className="profile-hero-compact">
        <div className="avatar-row">
          <div className="avatar-compact" style={{ borderColor: rank.color }}>
            {user?.avatarId || '👤'}
          </div>
          <div className="user-info-compact">
            <h2 className="username-compact">{user?.username || 'Player'}</h2>
            <div className="rank-pill" style={{ background: rank.color }}>{rank.name}</div>
          </div>
        </div>
        
        {/* Level Progress */}
        <div className="level-compact">
          <div className="level-header">
            <span>Level {(user as any)?.level || 1}</span>
            <span>{(user as any)?.xp || 0}/{(user as any)?.nextLevelXp || 100} XP</span>
          </div>
          <div className="xp-bar-compact">
            <div 
              className="xp-fill-compact" 
              style={{ 
                width: `${(((user as any)?.xp || 0) / ((user as any)?.nextLevelXp || 100)) * 100}%`,
                background: rank.color 
              }}
            />
          </div>
        </div>
      </div>

      {/* Horizontal Stats Scroll */}
      <div className="stats-scroll-compact">
        {stats.map((stat, i) => (
          <motion.div 
            key={i} 
            className="stat-pill-compact"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="stat-icon-compact" style={{ background: `${stat.color}20`, color: stat.color }}>
              <stat.icon size={16} />
            </div>
            <div className="stat-data-compact">
              <span className="stat-value-compact">{stat.value}</span>
              <span className="stat-label-compact">{stat.label}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Compact Tabs */}
      <div className="tabs-compact">
        <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>
          Stats
        </button>
        <button className={activeTab === 'achievements' ? 'active' : ''} onClick={() => setActiveTab('achievements')}>
          Badges
        </button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
          History
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content-compact">
        {activeTab === 'stats' && (
          <motion.div className="detailed-stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="stat-row-compact">
              <span>Achievements</span>
              <strong>{(user as any)?.achievements?.length || 0}</strong>
            </div>
            <div className="stat-row-compact">
              <span>Best Streak</span>
              <strong>{(user as any)?.bestStreak || 0}</strong>
            </div>
            <div className="stat-row-compact">
              <span>Current Streak</span>
              <strong>{(user as any)?.currentStreak || 0}</strong>
            </div>
            <div className="stat-row-compact">
              <span>Words Drawn</span>
              <strong>{(user as any)?.wordsDrawn || 0}</strong>
            </div>
            <div className="stat-row-compact">
              <span>Correct Guesses</span>
              <strong>{(user as any)?.correctGuesses || 0}</strong>
            </div>
          </motion.div>
        )}

        {activeTab === 'achievements' && (
          <motion.div className="achievements-compact" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {achievements.length === 0 ? (
              <p className="empty-compact">No badges yet</p>
            ) : (
              <div className="badges-grid">
                {achievements.map((ach, i) => (
                  <div key={i} className={`badge-item ${ach.unlockedAt ? 'unlocked' : 'locked'}`}>
                    <div className="badge-icon">{ach.icon || '🏆'}</div>
                    <span className="badge-name">{ach.name}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div className="history-compact" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {matchHistory.length === 0 ? (
              <p className="empty-compact">No matches yet</p>
            ) : (
              matchHistory.slice(0, 10).map((match, i) => (
                <div key={i} className="match-row">
                  <div className="match-result" style={{ 
                    background: match.result === 'win' ? 'rgba(0, 245, 164, 0.2)' : 'rgba(241, 91, 181, 0.2)',
                    color: match.result === 'win' ? '#00F5A0' : '#F15BB5'
                  }}>
                    {match.result === 'win' ? 'W' : 'L'}
                  </div>
                  <div className="match-info">
                    <span className="match-mode">{match.gameMode}</span>
                    <span className="match-date">{formatDate(match.date)}</span>
                  </div>
                  <div className="match-score">
                    <strong>{match.score}</strong>
                    <span>+{match.xpEarned} XP</span>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
