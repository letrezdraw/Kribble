import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import GameRoom from './pages/GameRoom';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import { LandingMobile, LoginMobile, LobbyMobile, GameRoomMobile, ProfileMobile, SettingsMobile } from './pages/mobile';
import VersionDisplay from './components/VersionDisplay';
import ErrorBoundary from './components/ErrorBoundary';
import './components/ErrorBoundary.css';
import K2GameRoomProvider from './k2/K2GameRoomProvider';




function App() {
  const { user, loading } = useAuth();
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading Kribble...</p>
      </div>
    );
  }


  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/lobby" /> : (isMobile ? <LandingMobile /> : <Landing />)} />
        <Route path="/login" element={user ? <Navigate to="/lobby" /> : (isMobile ? <LoginMobile /> : <Login />)} />
        <Route path="/lobby" element={user ? (isMobile ? <LobbyMobile /> : <Lobby />) : <Navigate to="/login" />} />
        <Route path="/room/:roomId" element={user ? (isMobile ? <GameRoomMobile /> : <K2GameRoomProvider><GameRoom /></K2GameRoomProvider>) : <Navigate to="/login" />} />
        <Route path="/profile" element={user ? (isMobile ? <ProfileMobile /> : <Profile />) : <Navigate to="/login" />} />
        <Route path="/settings" element={user ? (isMobile ? <SettingsMobile /> : <Settings />) : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <VersionDisplay />
    </ErrorBoundary>
  );


}


export default App;
