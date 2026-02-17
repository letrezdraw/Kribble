import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { GameProvider } from './contexts/GameContext';
import './styles/design-system.css';
import './styles/global.css';
import './styles/mobile.css';

// Load and apply settings on app startup
const loadSettings = () => {
  try {
    const saved = localStorage.getItem('kribble_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      
      // Apply theme
      document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
      if (settings.theme === 'light') {
        document.body.style.background = 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';
      }
      
      // Set global flags
      window.__SOUND_ENABLED__ = settings.sound !== false;
      window.__MUSIC_ENABLED__ = settings.music !== false;
      window.__HAPTIC_ENABLED__ = settings.haptic !== false;
      window.__CHAT_ENABLED__ = settings.chatEnabled !== false;
      window.__NOTIFICATIONS_ENABLED__ = settings.notifications !== false;
    }
  } catch (e) {
    // Silently handle errors
  }
};

// Load settings immediately
loadSettings();

ReactDOM.createRoot(document.getElementById('root')!).render(

  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <GameProvider>
            <App />
          </GameProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Global type declarations for settings
declare global {
  interface Window {
    __SOUND_ENABLED__: boolean;
    __MUSIC_ENABLED__: boolean;
    __HAPTIC_ENABLED__: boolean;
    __CHAT_ENABLED__: boolean;
    __NOTIFICATIONS_ENABLED__: boolean;
  }
}
