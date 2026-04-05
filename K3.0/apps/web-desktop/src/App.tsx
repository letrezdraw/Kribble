import { Routes, Route, Navigate } from 'react-router-dom';
import { useGameStore } from './stores/gameStore';
import { socketService } from './services/socket';
import { api } from './services/api';
import { LucideIcon } from 'lucide-react';
// import type { ServerMessage, User, Room } from '@kribble/shared-types';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import GamePage from './pages/GamePage';
import ErrorBoundary from './components/ErrorBoundary';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

function Header() {
  const { user, isConnected, isConnecting } = useGameStore();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');

  useEffect(() => {
    if (isConnecting) {
      setConnectionStatus('connecting');
    } else if (isConnected) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('disconnected');
    }
  }, [isConnected, isConnecting]);

  return (
    <motion.header 
      className="glass fixed top-0 left-0 right-0 z-40 px-6 py-4 shadow-lg"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold gradient-text">Kribble</div>
          {user && (
            <div className="text-sm bg-primary-100 text-primary-800 px-3 py-1 rounded-full font-medium">
              {user.displayName}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-sm">
            <div className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 animate-ping' : connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`} />
            {connectionStatus === 'connecting' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : connectionStatus === 'connected' ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span className="font-medium">
              {connectionStatus === 'connecting' ? 'Connecting...' : connectionStatus === 'connected' ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

function LoadingOverlay() {
  const { isConnecting } = useGameStore();

  if (!isConnecting) return null;

  return (
    <motion.div 
      className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="glass p-8 rounded-2xl text-center">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary-500" />
        <h2 className="text-2xl font-bold mb-2 gradient-text">Connecting...</h2>
        <p className="text-slate-400">Joining Kribble world</p>
      </div>
    </motion.div>
  );
}

export default function App() {
  const { setUser, setConnected, setConnecting, setCurrentRoom, setRooms, updateRoom } = useGameStore();

  useEffect(() => {
    // Set up WebSocket event handlers
    const unsubscribers: (() => void)[] = [];

    // Connection status
    unsubscribers.push(
      socketService.on('connected', () => {
        setConnected(true);
        setConnecting(false);
      })
    );

    unsubscribers.push(
      socketService.on('disconnected', () => {
        setConnected(false);
      })
    );

    // Auth
    unsubscribers.push(
      socketService.on('auth:success', (data) => {
        setUser({
          id: data.userId,
          displayName: data.displayName || 'Player',
          isGuest: data.isGuest || false,
        });
      })
    );

    // Room events
    unsubscribers.push(
      socketService.on('room:joined', (data) => {
        setCurrentRoom(data.room);
      })
    );

    unsubscribers.push(
      socketService.on('room:state', (data) => {
        setCurrentRoom(data.room);
      })
    );

    unsubscribers.push(
      socketService.on('room:updated', (data) => {
        updateRoom(data.room);
      })
    );

    unsubscribers.push(
      socketService.on('room:left', () => {
        setCurrentRoom(null);
      })
    );

    unsubscribers.push(
      socketService.on('rooms:list', (data) => {
        setRooms(data.rooms);
      })
    );

    // Connect to WebSocket
    socketService.connect();

    // Try to restore auth
    const token = api.getToken();
    if (token) {
      setConnecting(true);
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      socketService.disconnect();
    };
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden">
        <Header />
        <div className="pt-20 pb-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/room/:code" element={<RoomPage />} />
            <Route path="/game/:code" element={<GamePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <LoadingOverlay />
      </div>
    </ErrorBoundary>
  );
}
