import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { GameProvider } from './contexts/GameContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './styles/design-system.css';
import './styles/global.css';
import './styles/mobile.css';
import { applySettings, loadSettings } from './utils/settings';

// Load settings immediately
applySettings(loadSettings());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <GameProvider>
              <App />
            </GameProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
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
