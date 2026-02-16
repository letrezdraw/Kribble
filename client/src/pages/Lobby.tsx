import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, Users, Lock, Globe, Play, LogOut, 
  Zap, Trophy, Target, Gamepad2, Crown, Settings
} from 'lucide-react';


import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import Button from '../components/Button';
import CreateRoomModal from '../components/CreateRoomModal';
import { getRankByLevel } from '../utils/ranks';
import type { LeaderboardEntry } from '../types';
import api from '../services/api';


import './Lobby.css';

interface Room {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  isPrivate: boolean;
  gameMode: string;
  isInGame?: boolean;
}

export default function Lobby() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    fetchRooms();
    fetchOnlineCount();
    fetchLeaderboard();
    
    const interval = setInterval(() => {
      fetchRooms();
      fetchOnlineCount();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const fetchOnlineCount = async () => {
    try {
      const response = await api.get('/users/online/count');
      setOnlineCount(response.data.count);
    } catch (error) {
      console.error('Failed to fetch online count:', error);
    }
  };


  const fetchLeaderboard = async () => {
    try {
      const response = await api.get('/users/leaderboard?limit=5');
      setLeaderboard(response.data.leaderboard);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  };


  const fetchRooms = async () => {
    try {
      const response = await api.get('/rooms');
      setRooms(response.data.rooms || []);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    let filtered = rooms;
    if (filter === 'public') filtered = filtered.filter(r => !r.isPrivate);
    else if (filter === 'private') filtered = filtered.filter(r => r.isPrivate);
    if (searchQuery) {
      filtered = filtered.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredRooms(filtered);
  }, [searchQuery, filter, rooms]);

  const handleJoinRoom = (room: Room) => {
    if (room.isPrivate) {
      setSelectedRoom(room);
      setShowPasswordModal(true);
      setPasswordInput('');
    } else {
      navigate(`/room/${room.id}`);
    }
  };

  const handleQuickMatch = () => {
    const availableRoom = rooms.find(r => 
      !r.isPrivate && r.players < r.maxPlayers && !r.isInGame
    );
    if (availableRoom) {
      navigate(`/room/${availableRoom.id}`);
    } else {
      setShowCreateModal(true);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    navigate(`/room/${selectedRoom.id}`, { state: { password: passwordInput } });
    setShowPasswordModal(false);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    
    // Convert code to full room ID format
    const code = roomCodeInput.trim().toLowerCase();
    const roomId = `room-${code}`;
    navigate(`/room/${roomId}`, { state: { joinByCode: true } });
    setRoomCodeInput('');
  };



  const rank = getRankByLevel(user?.level || 1);

  return (
    <div className="lobby">
      {/* Header */}
      <header className="lobby-header">
        <div className="header-left">
          <Link to="/" className="logo">
            <span className="logo-icon">🎨</span>
            <span className="logo-text">Kribble</span>
          </Link>
        </div>
        
        <div className="header-right">
          <div className="online-indicator">
            <div className="online-dot"></div>
            <span>{onlineCount} online</span>
          </div>
          <div className="user-profile">
            <span className="username">{user?.username || 'Guest'}</span>
            <div 
              className="user-avatar" 
              style={{ borderColor: rank.color }}
              onClick={() => navigate('/profile')}
            >
              {user?.avatarId || '👤'}
            </div>
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
          <div className="sidebar-section">
            <div className="sidebar-title">Join by Code</div>
            <form className="join-code-form" onSubmit={handleJoinByCode}>
              <div className="join-code-input-wrapper">
                <input
                  type="text"
                  placeholder="Enter room code..."
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  className="join-code-input"
                  maxLength={20}
                />
                <button type="submit" className="join-code-btn">
                  <Play size={16} />
                </button>
              </div>
            </form>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-title">Quick Actions</div>
            <div className="quick-actions">

              <motion.button 
                key="quick-play"
                className="quick-action-btn primary"
                onClick={handleQuickMatch}
                whileTap={{ scale: 0.98 }}
              >
                <Gamepad2 size={20} />
                <span>Quick Play</span>
              </motion.button>
              
              <motion.button 
                key="leaderboard"
                className="quick-action-btn"
                onClick={() => setShowLeaderboard(true)}
                whileTap={{ scale: 0.98 }}
              >
                <Trophy size={20} />
                <span>Leaderboard</span>
              </motion.button>
              
              <motion.button 
                key="profile"
                className="quick-action-btn"
                onClick={() => navigate('/profile')}
                whileTap={{ scale: 0.98 }}
              >
                <Target size={20} />
                <span>My Profile</span>
              </motion.button>
              
              <motion.button 
                key="settings"
                className="quick-action-btn"
                onClick={() => navigate('/settings')}
                whileTap={{ scale: 0.98 }}
              >
                <Settings size={20} />
                <span>Settings</span>
              </motion.button>

            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-title">Top Players</div>
            <div className="leaderboard-preview">
              {leaderboard.slice(0, 5).map((entry, index) => {
                const entryRank = getRankByLevel(entry.level);
                return (
                  <div 
                    key={entry.userId}
                    className="leaderboard-item"
                    onClick={() => setShowLeaderboard(true)}
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
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lobby-content">
          {/* Top Bar */}
          <div className="lobby-top-bar">
            <div className="search-bar">
              <Search size={20} color="rgba(255,255,255,0.5)" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="lobby-filters">
              <button
                className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-tab ${filter === 'public' ? 'active' : ''}`}
                onClick={() => setFilter('public')}
              >
                <Globe size={16} />
                Public
              </button>
              <button
                className={`filter-tab ${filter === 'private' ? 'active' : ''}`}
                onClick={() => setFilter('private')}
              >
                <Lock size={16} />
                Private
              </button>
            </div>

            <button 
              className="create-room-desktop-btn"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={20} />
              <span>Create Room</span>
            </button>
          </div>

          {/* Room List */}
          <div className="rooms-list">
            {loading ? (
              <div className="rooms-loading">
                <div className="loader"></div>
                <p>Loading rooms...</p>
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="rooms-empty">
                <p>No rooms found</p>
                <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
                  Create Room
                </Button>
              </div>
            ) : (
              <AnimatePresence>
                {filteredRooms.map((room, index) => (
                  <motion.div
                    key={room.id}
                    className="room-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleJoinRoom(room)}
                  >
                    <div className="room-header">
                      <h3>{room.name}</h3>
                      <div className="room-badges">
                        {room.isPrivate ? (
                          <span className="room-badge private"><Lock size={14} /></span>
                        ) : (
                          <span className="room-badge public"><Globe size={14} /></span>
                        )}
                      </div>
                    </div>
                    
                    <div className="room-info">
                      <div className="room-stat">
                        <Users size={16} />
                        <span>{room.players}/{room.maxPlayers}</span>
                      </div>
                      <div className="room-stat">
                        <Zap size={16} />
                        <span>{room.gameMode}</span>
                      </div>
                    </div>
                    
                    <div className="room-progress">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${(room.players / room.maxPlayers) * 100}%`,
                          background: room.players >= room.maxPlayers ? '#ef4444' : undefined
                        }}
                      ></div>
                    </div>
                    
                    <Button 
                      variant="primary" 
                      size="sm" 
                      className="join-btn"
                      disabled={room.players >= room.maxPlayers}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoinRoom(room);
                      }}
                    >
                      {room.players >= room.maxPlayers ? 'Full' : (
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
      <button 
        className="create-room-btn"
        onClick={() => setShowCreateModal(true)}
        aria-label="Create room"
      >
        <Plus size={28} color="white" />
      </button>


      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.8)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'flex-end'
            }}
            onClick={() => setShowLeaderboard(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              style={{
                width: '100%',
                maxHeight: '80vh',
                background: '#0D1B2A',
                borderRadius: '24px 24px 0 0',
                padding: '20px',
                overflow: 'auto'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px'
              }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trophy size={24} color="#00F5D4" />
                  Top Players
                </h2>
                <button 
                  onClick={() => setShowLeaderboard(false)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: 'white'
                  }}
                >
                  ✕
                </button>
              </div>
              
              {leaderboard.map((entry, index) => {
                const entryRank = getRankByLevel(entry.level);
                return (
                  <div 
                    key={entry.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '12px',
                      marginBottom: '8px',
                      border: entry.userId === user?.id ? '1px solid #00F5D4' : 'none'
                    }}
                  >
                    <div style={{ 
                      width: '32px',
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: index < 3 ? '#00F5D4' : 'rgba(255,255,255,0.5)'
                    }}>
                      {index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </div>
                    <div style={{ fontSize: '1.5rem' }}>{entry.avatarId || '👤'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{entry.username}</div>
                      <div style={{ fontSize: '0.8rem', color: entryRank.color }}>
                        {entryRank.icon} {entryRank.name}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#00F5D4' }}>{entry.totalScore}</div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                        Lv.{entry.level}
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateRoomModal onClose={() => setShowCreateModal(false)} />
        )}
      </AnimatePresence>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && selectedRoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.8)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
            onClick={() => setShowPasswordModal(false)}
          >
            <motion.form
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onSubmit={handlePasswordSubmit}
              style={{
                width: '100%',
                maxWidth: '320px',
                background: '#0D1B2A',
                borderRadius: '20px',
                padding: '24px'
              }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ marginBottom: '8px' }}>Enter Password</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '20px', fontSize: '0.9rem' }}>
                Room: {selectedRoom.name}
              </p>
              <input
                type="password"
                placeholder="Password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '1rem',
                  marginBottom: '20px'
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button 
                  variant="ghost" 
                  type="button" 
                  style={{ flex: 1 }} 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPasswordModal(false);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit" style={{ flex: 1 }}>
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
