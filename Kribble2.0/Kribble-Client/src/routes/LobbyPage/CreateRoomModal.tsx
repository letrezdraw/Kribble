import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Lock, Globe, Users, Clock, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { DoodlerEvents, RoomEvents } from '@/constants/Events';
import { useSocket } from '@/contexts/socket';
import { useUser } from '@/contexts/user';

import Button from './Button';
import './CreateRoomModal.css';

interface CreateRoomModalProps {
  onClose: () => void;
}

const GAME_MODES = [
  {
    id: 'classic',
    name: 'Classic',
    icon: '🎨',
    description: 'Standard drawing & guessing',
  },
  { id: 'speed', name: 'Speed Run', icon: '⚡', description: 'Fast-paced rounds' },
  { id: 'team', name: 'Team Battle', icon: '👥', description: 'Play in teams' },
];

const ROUND_TIMES = [60, 90, 120, 180];
const MAX_PLAYERS_OPTIONS = [4, 6, 8, 12];
const ROUNDS_OPTIONS = [3, 5, 7, 10];

export default function CreateRoomModal({ onClose }: CreateRoomModalProps) {
  const navigate = useNavigate();
  const { asyncEmitEvent } = useSocket();
  const { user } = useUser();

  const [roomName, setRoomName] = useState(`${user?.name?.trim() || 'Player'}'s Room`);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [roundTime, setRoundTime] = useState(120);
  const [rounds, setRounds] = useState(5);
  const [gameMode, setGameMode] = useState('classic');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user.name.trim()) {
      window.alert('Set your name on the home page first.');
      return;
    }

    setLoading(true);
    try {
      await asyncEmitEvent(DoodlerEvents.EMIT_SET_DOODLER, {
        name: user.name,
        avatar: user.avatar,
      });
      /** UI matches V1; Kribble 2.0 server creates a private room (settings above are not persisted yet). */
      const { roomId } = await asyncEmitEvent(
        RoomEvents.EMIT_CREATE_PRIVATE_ROOM,
        undefined
      );
      navigate(`/${roomId}`);
      onClose();
    } catch {
      window.alert('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="create-room-modal"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="modal-inner">
          <div className="modal-header">
            <h2>Create Room</h2>
            <button type="button" className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleCreate} className="modal-form">
            <div className="form-group">
              <label>Room Name</label>
              <input
                type="text"
                value={roomName}
                onChange={(ev) => setRoomName(ev.target.value)}
                placeholder="Enter room name"
                maxLength={30}
              />
            </div>

            <div className="form-group">
              <label>Game Mode</label>
              <div className="mode-options">
                {GAME_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`mode-btn ${gameMode === mode.id ? 'active' : ''}`}
                    onClick={() => setGameMode(mode.id)}
                  >
                    <span className="mode-icon">{mode.icon}</span>
                    <span className="mode-name">{mode.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-grid">
              <div className="setting-item">
                <label>
                  <Users size={14} />
                  Players
                </label>
                <select
                  value={maxPlayers}
                  onChange={(ev) => setMaxPlayers(Number(ev.target.value))}
                >
                  {MAX_PLAYERS_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="setting-item">
                <label>
                  <Clock size={14} />
                  Time
                </label>
                <select
                  value={roundTime}
                  onChange={(ev) => setRoundTime(Number(ev.target.value))}
                >
                  {ROUND_TIMES.map((t) => (
                    <option key={t} value={t}>
                      {t}s
                    </option>
                  ))}
                </select>
              </div>

              <div className="setting-item">
                <label>
                  <Trophy size={14} />
                  Rounds
                </label>
                <select
                  value={rounds}
                  onChange={(ev) => setRounds(Number(ev.target.value))}
                >
                  {ROUNDS_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <button
                type="button"
                className="privacy-toggle-btn"
                onClick={() => setIsPrivate(!isPrivate)}
              >
                <div className="privacy-info">
                  {isPrivate ? (
                    <Lock size={20} className="icon-private" />
                  ) : (
                    <Globe size={20} className="icon-public" />
                  )}
                  <div className="privacy-text">
                    <div className="privacy-title">
                      {isPrivate ? 'Private Room' : 'Public Room'}
                    </div>
                    <div className="privacy-desc">
                      {isPrivate ? 'Password required' : 'Anyone can join'}
                    </div>
                  </div>
                </div>
                <div className={`toggle-switch ${isPrivate ? 'active' : ''}`}>
                  <div className="toggle-knob" />
                </div>
              </button>

              {isPrivate && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="password-field"
                >
                  <input
                    type="password"
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    placeholder="Set room password"
                  />
                </motion.div>
              )}
            </div>

            <div className="modal-actions">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                fullWidth
              >
                Create Room
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
