import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Socket as IoClientSocket } from 'socket.io-client';
import {
  Search,
  Plus,
  Users,
  Lock,
  Globe,
  Play,
  LogOut,
  Zap,
  Trophy,
  Target,
  Gamepad2,
  Sparkles,
} from 'lucide-react';

import { DoodlerEvents, RoomEvents } from '@/constants/Events';
import { socket, useSocket } from '@/contexts/socket';
import { useUser } from '@/contexts/user';
import { ErrorFromServer } from '@/utils/error';
import { getRankByLevel } from '@/utils/v1/ranks';

import Button from './Button';
import CreateRoomModal from './CreateRoomModal';
import {
  LOBBY_THEME_ORDER,
  LOBBY_THEMES,
  LobbyTheme,
} from './lobbyThemes';

import './Lobby.css';

interface Room {
  id: string;
  name: string;
  hostName?: string;
  playerCount: number;
  maxPlayers: number;
  isPrivate: boolean;
  gameMode: string;
  phase: string;
}

/** Kribble 1.0 leaderboard row (REST API not wired in 2.0 yet — UI shell only). */
interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarId: string;
  level: number;
  totalScore: number;
}

// Particle background component
const ParticleBackground = () => {
  return (
    <div className="particle-background">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="particle"
          initial={{ 
            x: Math.random() * 100 + '%', 
            y: Math.random() * 100 + '%',
            scale: 0 
          }}
          animate={{ 
            y: [null, '-100%'],
            scale: [0, 1, 0],
            opacity: [0, 0.5, 0]
          }}
          transition={{ 
            duration: 10 + Math.random() * 10,
            repeat: Infinity,
            delay: Math.random() * 5
          }}
          style={{
            left: `${Math.random() * 100}%`,
            top: '100%',
            width: `${4 + Math.random() * 8}px`,
            height: `${4 + Math.random() * 8}px`,
          }}
        />
      ))}
    </div>
  );
};

export default function LobbyPage() {
  const { user, resetUser } = useUser();
  const { asyncEmitEvent } = useSocket();
  const navigate = useNavigate();
  const lobbyRef = useRef<HTMLDivElement>(null);

  const [theme, setTheme] = useState<LobbyTheme>(() => {
    const saved = localStorage.getItem('kribble-theme') as LobbyTheme | null;
    return saved && LOBBY_THEME_ORDER.includes(saved) ? saved : 'midnight';
  });

  useEffect(() => {
    const el = lobbyRef.current;
    if (!el) return;
    const vars = LOBBY_THEMES[theme];
    Object.entries(vars).forEach(([key, value]) => {
      el.style.setProperty(key, value);
    });
    localStorage.setItem('kribble-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const i = LOBBY_THEME_ORDER.indexOf(theme);
    setTheme(LOBBY_THEME_ORDER[(i + 1) % LOBBY_THEME_ORDER.length]);
  };

  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loading, setLoading] = useState(true);

  const [onlineCount, setOnlineCount] = useState(0);
  const [leaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    const raw = socket as unknown as IoClientSocket;

    const refresh = () => {
      raw.emit('lobby:get-rooms');
    };
    refresh();

    const onLobbyData = (data: {
      rooms: Room[];
      onlineCount?: number;
    }) => {
      setRooms(data.rooms || []);
      if (typeof data.onlineCount === 'number') {
        setOnlineCount(data.onlineCount);
      }
      setLoading(false);
    };

    raw.on('lobby:rooms', onLobbyData);
    raw.on('lobby:rooms-updated', onLobbyData);

    const interval = setInterval(refresh, 3000);

    return () => {
      clearInterval(interval);
      raw.off('lobby:rooms', onLobbyData);
      raw.off('lobby:rooms-updated', onLobbyData);
    };
  }, []);

  useEffect(() => {
    let filtered = rooms;
    if (filter === 'public') filtered = filtered.filter((r) => !r.isPrivate);
    else if (filter === 'private') filtered = filtered.filter((r) => r.isPrivate);
    if (searchQuery) {
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredRooms(filtered);
  }, [searchQuery, filter, rooms]);

  const ensureDoodler = async () => {
    if (!user.name.trim()) {
      navigate('/');
      return false;
    }
    await asyncEmitEvent(DoodlerEvents.EMIT_SET_DOODLER, {
      name: user.name,
      avatar: user.avatar,
    });
    return true;
  };

  const joinPublicById = async (roomId: string) => {
    if (!(await ensureDoodler())) return;
    try {
      await asyncEmitEvent(RoomEvents.EMIT_ADD_DOODLER_TO_SPECIFIC_PUBLIC_ROOM, {
        roomId,
      });
      navigate(`/${roomId}`);
    } catch (e) {
      if (e instanceof ErrorFromServer) {
        window.alert(e.message);
      }
    }
  };

  const joinPrivateById = async (roomId: string) => {
    if (!(await ensureDoodler())) return;
    try {
      const { room } = await asyncEmitEvent(
        RoomEvents.EMIT_ADD_DOODLER_TO_PRIVATE_ROOM,
        { roomId }
      );
      navigate(`/${room.id}`);
    } catch (e) {
      if (e instanceof ErrorFromServer) {
        window.alert(e.message);
      }
    }
  };

  const handleJoinRoom = (room: Room) => {
    if (room.isPrivate) {
      setSelectedRoom(room);
      setShowPasswordModal(true);
      setPasswordInput('');
    } else {
      void joinPublicById(room.id);
    }
  };

  const handleQuickMatch = () => {
    const availableRoom = rooms.find(
      (r) =>
        !r.isPrivate &&
        r.playerCount < r.maxPlayers &&
        r.phase === 'waiting'
    );
    if (availableRoom) {
      void joinPublicById(availableRoom.id);
    } else {
      setShowCreateModal(true);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    setShowPasswordModal(false);
    await joinPrivateById(selectedRoom.id);
  };

  const handleJoinByCode = async (e: FormEvent) => {
    e.preventDefault();
    const code = roomCodeInput.trim();
    if (!code) return;
    if (!(await ensureDoodler())) return;
    try {
      const { roomId } = await asyncEmitEvent(
        RoomEvents.EMIT_ADD_DOODLER_TO_SPECIFIC_PUBLIC_ROOM,
        { roomId: code }
      );
      navigate(`/${roomId}`);
    } catch {
      try {
        const { room } = await asyncEmitEvent(
          RoomEvents.EMIT_ADD_DOODLER_TO_PRIVATE_ROOM,
          { roomId: code }
        );
        navigate(`/${room.id}`);
      } catch (err) {
        if (err instanceof ErrorFromServer) {
          window.alert(err.message);
        }
      }
    }
    setRoomCodeInput('');
  };

  const rank = getRankByLevel(1);

  const getThemeIcon = () => {
    switch (theme) {
      case 'ocean':
        return '🌊';
      case 'sunset':
        return '🌅';
      case 'forest':
        return '🌲';
      default:
        return '🌙';
    }
  };

  const logout = () => {
    resetUser();
    navigate('/');
  };

  return (
    <div className="lobby" ref={lobbyRef}>
      <ParticleBackground />
      
      {/* Header */}
      <header className="lobby-header glass">
        <div className="header-left">
          <Link to="/" className="logo">
            <span className="logo-icon">
              <Sparkles size={28} />
            </span>
            <span className="logo-text">Kribble</span>
          </Link>
        </div>
        
        <div className="header-right">
          {/* Theme Switcher */}
          <motion.button
            className="theme-toggle glass"
            onClick={toggleTheme}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={`Theme: ${theme}`}
          >
            <span className="theme-icon">{getThemeIcon()}</span>
          </motion.button>

          <div className="online-indicator glass">
            <div className="online-dot pulse"></div>
            <span>{onlineCount} online</span>
          </div>
          
          <div className="user-profile glass">
            <span className="username">{user?.name?.trim() || 'Guest'}</span>
            <motion.div 
              className="user-avatar" 
              style={{ borderColor: rank.color }}
              onClick={() => navigate('/profile')}
              whileHover={{ scale: 1.1 }}
            >
              🎨
            </motion.div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut size={18} />
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="lobby-main">
        {/* Sidebar */}
        <aside className="lobby-sidebar">
          <motion.div 
            className="sidebar-section glass"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="sidebar-title">
              <Zap size={16} />
              Join by Code
            </div>
            <form className="join-code-form" onSubmit={handleJoinByCode}>
              <div className="join-code-input-wrapper glass">
                <input
                  type="text"
                  placeholder="Enter code..."
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  className="join-code-input"
                  maxLength={64}
                />
                <motion.button 
                  type="submit" 
                  className="join-code-btn"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Play size={16} />
                </motion.button>
              </div>
            </form>
          </motion.div>

          <motion.div 
            className="sidebar-section glass"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="sidebar-title">
              <Gamepad2 size={16} />
              Quick Actions
            </div>
            <div className="quick-actions">
              <motion.button 
                className="quick-action-btn primary glass"
                onClick={handleQuickMatch}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <Zap size={20} />
                <span>Quick Play</span>
              </motion.button>
              
              <motion.button 
                className="quick-action-btn glass"
                onClick={() => setShowLeaderboard(true)}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <Trophy size={20} />
                <span>Leaderboard</span>
              </motion.button>
              
              <motion.button 
                className="quick-action-btn glass"
                onClick={() => navigate('/profile')}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <Target size={20} />
                <span>My Profile</span>
              </motion.button>
            </div>
          </motion.div>

          <motion.div 
            className="sidebar-section glass"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="sidebar-title">
              <Trophy size={16} />
              Top Players
            </div>
            <div className="leaderboard-preview">
              {leaderboard.slice(0, 5).map((entry, index) => {
                const entryRank = getRankByLevel(entry.level);
                return (
                  <motion.div 
                    key={entry.userId || `lb-${index}`}
                    className="leaderboard-item glass-hover"
                    onClick={() => setShowLeaderboard(true)}
                    whileHover={{ x: 4 }}
                  >
                    <div className={`leaderboard-rank ${index < 3 ? 'top' : ''}`}>
                      {index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </div>
                    <div className="leaderboard-avatar">{entry.avatarId || '👤'}</div>
                    <div className="leaderboard-info">
                      <div className="leaderboard-name">{entry.username}</div>
                      <div className="leaderboard-rank-name" style={{ color: entryRank.color }}>
                        {entryRank.name}
                      </div>
                    </div>
                    <div className="leaderboard-score">{entry.totalScore}</div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </aside>

        {/* Main Content */}
        <main className="lobby-content">
          {/* Top Bar */}
          <motion.div 
            className="lobby-top-bar glass"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="search-bar glass">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="lobby-filters">
              <motion.button
                className={`filter-tab glass ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                All
              </motion.button>
              <motion.button
                className={`filter-tab glass ${filter === 'public' ? 'active' : ''}`}
                onClick={() => setFilter('public')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Globe size={16} />
                Public
              </motion.button>
              <motion.button
                className={`filter-tab glass ${filter === 'private' ? 'active' : ''}`}
                onClick={() => setFilter('private')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Lock size={16} />
                Private
              </motion.button>
            </div>

            <motion.button 
              className="create-room-desktop-btn glass"
              onClick={() => setShowCreateModal(true)}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus size={20} />
              <span>Create Room</span>
            </motion.button>
          </motion.div>

          {/* Room List */}
          <div className="rooms-list">
            {loading ? (
              <div className="rooms-loading">
                <motion.div 
                  className="loader"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <p>Loading rooms...</p>
              </div>
            ) : filteredRooms.length === 0 ? (
              <motion.div 
                className="rooms-empty glass"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Sparkles size={48} className="empty-icon" />
                <p>No rooms found</p>
                <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
                  Create Room
                </Button>
              </motion.div>
            ) : (
              <AnimatePresence>
                {filteredRooms.map((room, index) => (
                  <motion.div
                    key={room.id}
                    className="room-card glass"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    onClick={() => handleJoinRoom(room)}
                  >
                    <div className="room-header">
                      <h3>{room.name}</h3>
                      <div className="room-badges">
                        {room.isPrivate ? (
                          <span className="room-badge private glass">
                            <Lock size={14} />
                          </span>
                        ) : (
                          <span className="room-badge public glass">
                            <Globe size={14} />
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="room-info">
                      <div className="room-stat">
                        <Users size={16} />
                        <span>{room.playerCount}/{room.maxPlayers}</span>
                      </div>
                      <div className="room-stat">
                        <Zap size={16} />
                        <span>{room.gameMode}</span>
                      </div>
                    </div>
                    
                    <div className="room-progress glass">
                      <motion.div 
                        className="progress-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${(room.playerCount / room.maxPlayers) * 100}%` }}
                        transition={{ duration: 0.5 }}
                        style={{ 
                          background: room.playerCount >= room.maxPlayers 
                            ? 'var(--error)' 
                            : `linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))`
                        }}
                      />
                    </div>
                    
                    <Button 
                      variant="primary" 
                      size="sm" 
                      className="join-btn"
                      disabled={room.playerCount >= room.maxPlayers}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoinRoom(room);
                      }}
                    >
                      {room.playerCount >= room.maxPlayers ? 'Full' : (
                        <><Play size={16} /> Join</>
                      )}
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>

      {/* Floating Create Button (Mobile) */}
      <motion.button 
        className="create-room-btn glass"
        onClick={() => setShowCreateModal(true)}
        aria-label="Create room"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Plus size={28} color="white" />
      </motion.button>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            key="leaderboard-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowLeaderboard(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="leaderboard-modal glass"
              onClick={e => e.stopPropagation()}
            >
              <div className="leaderboard-header">
                <h2>
                  <Trophy size={24} />
                  Top Players
                </h2>
                <button 
                  className="close-btn glass"
                  onClick={() => setShowLeaderboard(false)}
                >
                  ✕
                </button>
              </div>
              
              {leaderboard.map((entry, index) => {
                const entryRank = getRankByLevel(entry.level);
                return (
                  <motion.div 
                    key={entry.userId}
                    className={`leaderboard-row glass-hover ${entry.userId === user.id ? 'current-user' : ''}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className={`leaderboard-rank ${index < 3 ? 'top' : ''}`}>
                      {index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </div>
                    <div className="leaderboard-avatar">{entry.avatarId || '👤'}</div>
                    <div className="leaderboard-info">
                      <div className="leaderboard-name">{entry.username}</div>
                      <div className="leaderboard-rank-name" style={{ color: entryRank.color }}>
                        {entryRank.icon} {entryRank.name}
                      </div>
                    </div>
                    <div className="leaderboard-stats">
                      <div className="leaderboard-score">{entry.totalScore}</div>
                      <div className="leaderboard-level">Lv.{entry.level}</div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateRoomModal key="create-room-modal" onClose={() => setShowCreateModal(false)} />
        )}
      </AnimatePresence>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && selectedRoom && (
          <motion.div
            key="password-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowPasswordModal(false)}
          >
            <motion.form
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onSubmit={handlePasswordSubmit}
              className="password-modal glass"
              onClick={e => e.stopPropagation()}
            >
              <h3>Enter Password</h3>
              <p className="password-subtitle">
                Room: {selectedRoom.name}
              </p>
              <input
                type="password"
                placeholder="Password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="password-input"
                autoFocus
              />
              <div className="password-actions">
                <Button 
                  variant="ghost" 
                  type="button" 
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Join
                </Button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
