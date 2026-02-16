import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Lock, Globe, Play, LogOut, Trophy, Gamepad2, Target, Search, Hash, Settings, Sparkles } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import Button from '../../components/Button';
import CreateRoomMobile from './CreateRoomMobile';
import { getRankByLevel } from '../../utils/ranks';
import api from '../../services/api';
import './LobbyMobile.css';





interface Room { id: string; name: string; players: number; maxPlayers: number; isPrivate: boolean; gameMode: string; isInGame?: boolean; }

export default function LobbyMobile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showRoomCodeModal, setShowRoomCodeModal] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');

  const [onlineCount, setOnlineCount] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    fetchRooms(); fetchOnlineCount(); fetchLeaderboard();
    const interval = setInterval(() => { fetchRooms(); fetchOnlineCount(); }, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchOnlineCount = async () => {
    try { const res = await api.get('/users/online/count'); setOnlineCount(res.data.count); } catch {}
  };

  const fetchLeaderboard = async () => {
    try { const res = await api.get('/users/leaderboard?limit=5'); setLeaderboard(res.data.leaderboard); } catch {}
  };

  const fetchRooms = async () => {
    try { const res = await api.get('/rooms'); setRooms(res.data.rooms || []); } catch {}
  };


  const handleJoinRoom = (room: Room) => {
    if (room.isPrivate) { setSelectedRoom(room); setShowPasswordModal(true); setPasswordInput(''); }
    else { navigate(`/room/${room.id}`); }
  };

  const handleQuickMatch = () => {
    const available = rooms.find(r => !r.isPrivate && r.players < r.maxPlayers && !r.isInGame);
    if (available) navigate(`/room/${available.id}`);
    else setShowCreateModal(true);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    navigate(`/room/${selectedRoom.id}`, { state: { password: passwordInput } });
    setShowPasswordModal(false);
  };

  const handleRoomCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    const code = roomCodeInput.trim().toLowerCase();
    navigate(`/room/room-${code}`, { state: { joinByCode: true } });
    setShowRoomCodeModal(false);
    setRoomCodeInput('');
  };

  const filteredRooms = rooms.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const rank = getRankByLevel(user?.level || 1);

  return (
    <div className="lobby-mobile-compact">
      {/* Compact Header */}
      <header className="lobby-header-compact">
        <div className="logo-row-compact">
          <span className="logo-emoji">🎨</span>
          <span className="logo-text">Kribble</span>
          <Sparkles size={14} className="sparkle-icon" />
        </div>
        <div className="header-actions-compact">
          <div className="online-pill">
            <div className="online-dot-compact"></div>
            <span>{onlineCount}</span>
          </div>
          <button className="icon-btn-compact" onClick={() => navigate('/settings')}>
            <Settings size={18} />
          </button>
          <div className="user-info-compact" onClick={() => navigate('/profile')}>
            <div 
              className="user-avatar-compact" 
              style={{ borderColor: rank.color }}
            >
              {user?.avatarId || '👤'}
            </div>
            <span className="username-compact">{user?.username || 'Guest'}</span>
          </div>
        </div>

      </header>

      {/* User Stats Bar */}
      <div className="user-stats-bar">
        <div className="stat-pill">
          <Trophy size={14} />
          <span>{(user as any)?.totalScore || 0}</span>
        </div>
        <div className="rank-pill-compact" style={{ background: rank.color }}>
          {rank.name}
        </div>
      </div>

      {/* Quick Actions - Horizontal Scroll */}
      <div className="quick-actions-compact">
        <motion.button 
          className="action-pill primary"
          onClick={handleQuickMatch}
          whileTap={{ scale: 0.95 }}
        >
          <Gamepad2 size={20} />
          <span>Quick Play</span>
        </motion.button>
        <motion.button 
          className="action-pill"
          onClick={() => setShowRoomCodeModal(true)}
          whileTap={{ scale: 0.95 }}
        >
          <Hash size={20} />
          <span>Join Code</span>
        </motion.button>
        <motion.button 
          className="action-pill"
          onClick={() => setShowLeaderboard(true)}
          whileTap={{ scale: 0.95 }}
        >
          <Trophy size={20} />
          <span>Leaderboard</span>
        </motion.button>
        <motion.button 
          className="action-pill"
          onClick={() => navigate('/profile')}
          whileTap={{ scale: 0.95 }}
        >
          <Target size={20} />
          <span>Profile</span>
        </motion.button>
      </div>

      {/* Search Bar - Compact */}
      <div className="search-compact">
        <Search size={18} color="rgba(255,255,255,0.5)" />
        <input 
          type="text" 
          placeholder="Find rooms..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
        />
        {searchQuery && (
          <button className="clear-search" onClick={() => setSearchQuery('')}>✕</button>
        )}
      </div>

      {/* Room Count */}
      <div className="rooms-header-compact">
        <span>Available Rooms</span>
        <span className="room-count">{filteredRooms.length}</span>
      </div>

      {/* Rooms List - Compact Cards */}
      <div className="rooms-list-compact">
        {filteredRooms.length === 0 ? (
          <div className="empty-rooms-compact">
            <p>No rooms available</p>
            <span>Create one to get started!</span>
          </div>
        ) : (
          filteredRooms.map((room, i) => (
            <motion.div 
              key={room.id} 
              className="room-row-compact"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ delay: i * 0.05 }}
              onClick={() => handleJoinRoom(room)}
            >
              <div className="room-info-compact">
                <div className="room-name-row">
                  <h4>{room.name}</h4>
                  {room.isPrivate ? (
                    <Lock size={12} className="privacy-icon private" />
                  ) : (
                    <Globe size={12} className="privacy-icon public" />
                  )}
                </div>
                <div className="room-meta">
                  <Users size={12} />
                  <span>{room.players}/{room.maxPlayers}</span>
                  <span className="divider">•</span>
                  <span className="game-mode">{room.gameMode}</span>
                </div>
              </div>
              <button 
                className={`join-btn-compact ${room.players >= room.maxPlayers ? 'full' : ''}`}
                disabled={room.players >= room.maxPlayers}
                onClick={(e) => { e.stopPropagation(); handleJoinRoom(room); }}
              >
                {room.players >= room.maxPlayers ? 'Full' : <Play size={14} />}
              </button>
            </motion.div>
          ))
        )}
      </div>

      {/* Floating Action Button */}
      <motion.button 
        className="fab-compact"
        onClick={() => setShowCreateModal(true)}
        whileTap={{ scale: 0.9 }}
      >
        <Plus size={24} />
      </motion.button>

      {/* Bottom Sheet - Leaderboard */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div 
            className="sheet-overlay" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setShowLeaderboard(false)}
          >
            <motion.div 
              className="bottom-sheet-compact" 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }} 
              onClick={e => e.stopPropagation()}
            >
              <div className="sheet-handle"></div>
              <div className="sheet-header-compact">
                <Trophy size={20} color="#00F5D4" />
                <h3>Top Players</h3>
                <button className="close-sheet" onClick={() => setShowLeaderboard(false)}>✕</button>
              </div>
              <div className="leaderboard-list-compact">
                {leaderboard.map((entry, i) => {
                  const entryRank = getRankByLevel(entry.level);
                  const isCurrentUser = entry.userId === user?.id;
                  return (
                    <div 
                      key={entry.userId} 
                      className={`leaderboard-row ${isCurrentUser ? 'current-user' : ''}`}
                    >
                      <div className="rank-badge">#{i + 1}</div>
                      <div className="player-avatar-sm">{entry.avatarId || '👤'}</div>
                      <div className="player-info-sm">
                        <span className="player-name">{entry.username}</span>
                        <span className="player-rank" style={{ color: entryRank.color }}>{entryRank.name}</span>
                      </div>
                      <div className="player-score">{entry.totalScore}</div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreateModal && <CreateRoomMobile onClose={() => setShowCreateModal(false)} />}
      </AnimatePresence>


      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && selectedRoom && (
          <motion.div 
            className="modal-overlay-compact" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setShowPasswordModal(false)}
          >
            <motion.form 
              className="modal-compact" 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.9, y: 20 }} 
              onSubmit={handlePasswordSubmit} 
              onClick={e => e.stopPropagation()}
            >
              <h3>🔒 Private Room</h3>
              <p className="room-name">{selectedRoom.name}</p>
              <input 
                type="password" 
                placeholder="Enter password" 
                value={passwordInput} 
                onChange={(e) => setPasswordInput(e.target.value)} 
                autoFocus 
              />
              <div className="modal-buttons">
                <Button variant="ghost" type="button" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Join Room
                </Button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room Code Modal */}
      <AnimatePresence>
        {showRoomCodeModal && (
          <motion.div 
            className="modal-overlay-compact" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setShowRoomCodeModal(false)}
          >
            <motion.form 
              className="modal-compact" 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.9, y: 20 }} 
              onSubmit={handleRoomCodeSubmit} 
              onClick={e => e.stopPropagation()}
            >
              <h3>🔗 Join by Code</h3>
              <p>Enter 6-character room code</p>
              <input 
                type="text" 
                placeholder="ABC123" 
                value={roomCodeInput} 
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} 
                autoFocus 
                maxLength={6}
                className="code-input"
              />
              <div className="modal-buttons">
                <Button variant="ghost" type="button" onClick={() => setShowRoomCodeModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Join Room
                </Button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
