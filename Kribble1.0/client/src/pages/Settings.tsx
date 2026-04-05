import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Bell, Shield, Palette, Volume2, Moon, Globe, Smartphone, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Button from '../components/Button';
import './Settings.css';

// Default settings
const DEFAULT_SETTINGS = {
  username: '',
  email: '',
  theme: 'dark',
  sound: true,
  music: true,
  notifications: true,
  emailNotifications: false,
  profilePublic: true,
  chatEnabled: true,
  language: 'en',
  haptic: true,
  gameInvites: true,
  friendRequests: true,
};

// Load settings from localStorage
const loadSettings = () => {
  try {
    const saved = localStorage.getItem('kribble_settings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    // Silently handle localStorage errors - use defaults
  }
  return DEFAULT_SETTINGS;
};

// Save settings to localStorage
const saveSettingsToStorage = (settings: typeof DEFAULT_SETTINGS) => {
  try {
    localStorage.setItem('kribble_settings', JSON.stringify(settings));
  } catch (e) {
    // Silently handle localStorage errors
  }
};

// Apply theme to document
const applyTheme = (theme: string) => {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    document.body.style.background = 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)';
  } else {
    document.body.style.background = 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';
  }
};

// Apply sound setting
const applySound = (enabled: boolean) => {
  window.__SOUND_ENABLED__ = enabled;
};

// Apply music setting
const applyMusic = (enabled: boolean) => {
  window.__MUSIC_ENABLED__ = enabled;
  const audio = document.getElementById('bg-music') as HTMLAudioElement;
  if (audio) {
    if (enabled) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }
};

// Apply haptic setting
const applyHaptic = (enabled: boolean) => {
  window.__HAPTIC_ENABLED__ = enabled;
};

// Apply chat setting
const applyChat = (enabled: boolean) => {
  window.__CHAT_ENABLED__ = enabled;
  document.body.setAttribute('data-chat-enabled', String(enabled));
};

// Apply notifications setting
const applyNotifications = (enabled: boolean) => {
  if (enabled && 'Notification' in window) {
    Notification.requestPermission();
  }
  window.__NOTIFICATIONS_ENABLED__ = enabled;
};

// Apply all settings
const applyAllSettings = (settings: typeof DEFAULT_SETTINGS) => {
  applyTheme(settings.theme);
  applySound(settings.sound);
  applyMusic(settings.music);
  applyHaptic(settings.haptic);
  applyChat(settings.chatEnabled);
  applyNotifications(settings.notifications);
};

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'privacy' | 'notifications'>('account');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [settings, setSettings] = useState(() => {
    const loaded = loadSettings();
    return {
      ...loaded,
      username: user?.username || loaded.username || '',
      email: user?.email || loaded.email || '',
    };
  });

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Apply settings on mount
  useEffect(() => {
    applyAllSettings(settings);
  }, []);

  // Load settings from API on mount
  useEffect(() => {
    const fetchSettings = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      try {
        const response = await api.get(`/users/${user.id}/settings`);
        if (response.data.settings) {
          const newSettings = {
            ...settings,
            ...response.data.settings,
            username: user?.username || settings.username,
            email: user?.email || settings.email,
          };
          setSettings(newSettings);
          applyAllSettings(newSettings);
        }
      } catch (err: any) {
        // Silently handle API error - fall back to localStorage
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user?.id]);

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    saveSettingsToStorage(settings);
    applyAllSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      // Save to localStorage first
      saveSettingsToStorage(settings);
      
      // Apply all settings immediately
      applyAllSettings(settings);
      
      // Save to API if user is logged in
      if (user?.id) {
        await api.put(`/users/${user.id}/settings`, {
          settings: {
            theme: settings.theme,
            sound: settings.sound,
            music: settings.music,
            notifications: settings.notifications,
            emailNotifications: settings.emailNotifications,
            profilePublic: settings.profilePublic,
            chatEnabled: settings.chatEnabled,
            language: settings.language,
            haptic: settings.haptic,
            gameInvites: settings.gameInvites,
            friendRequests: settings.friendRequests,
          }
        });
      }
      
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword) {
      setError('Please enter both current and new password');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      await api.put('/auth/password', {
        currentPassword,
        newPassword
      });
      setSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      await api.delete('/auth/account');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('kribble_settings');
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete account');
      setShowDeleteConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="settings-page">
      {/* Header */}
      <header className="settings-header">
        <Button variant="ghost" size="sm" onClick={() => navigate('/profile')}>
          <ArrowLeft size={20} />
        </Button>
        <h1>Settings</h1>
        <div style={{ width: 40 }}></div>
      </header>

      {/* Tabs */}
      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="settings-content">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'account' && (
            <div className="settings-section">
              <h2>Account Settings</h2>
              
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={settings.username}
                  onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                  placeholder="Enter username"
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="Enter email"
                />
              </div>

              <div className="form-group">
                <label>Change Password</label>
                <input 
                  type="password" 
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{ marginBottom: '12px' }}
                />
                <input 
                  type="password" 
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ marginBottom: '12px' }}
                />
                <Button 
                  variant="secondary" 
                  onClick={handlePasswordChange}
                  loading={saving}
                  disabled={saving || !currentPassword || !newPassword}
                  style={{ width: '100%' }}
                >
                  Update Password
                </Button>
              </div>

              {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
              {success && <div className="success-message" style={{ marginBottom: '16px', color: '#4ade80' }}>{success}</div>}
              
              <Button variant="primary" onClick={handleSave} className="save-btn" loading={saving} disabled={saving}>
                Save Changes
              </Button>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="settings-section">
              <h2>Preferences</h2>
              
              <div className="toggle-item">
                <div>
                  <label>Sound Effects</label>
                  <p>Enable game sound effects</p>
                </div>
                <button 
                  className={`toggle-switch ${settings.sound ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, sound: !settings.sound })}
                >
                  <span className="toggle-knob"></span>
                </button>
              </div>

              <div className="toggle-item">
                <div>
                  <label>Background Music</label>
                  <p>Enable background music</p>
                </div>
                <button 
                  className={`toggle-switch ${settings.music ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, music: !settings.music })}
                >
                  <span className="toggle-knob"></span>
                </button>
              </div>

              <div className="toggle-item">
                <div>
                  <label>Haptic Feedback</label>
                  <p>Vibrate on touch interactions</p>
                </div>
                <button 
                  className={`toggle-switch ${settings.haptic ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, haptic: !settings.haptic })}
                >
                  <span className="toggle-knob"></span>
                </button>
              </div>

              <div className="toggle-item">
                <div>
                  <label>Dark Mode</label>
                  <p>Use dark theme</p>
                </div>
                <button 
                  className={`toggle-switch ${settings.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })}
                >
                  <span className="toggle-knob"></span>
                </button>
              </div>

              <div className="form-group" style={{ marginTop: '24px' }}>
                <label>Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="en" style={{ background: '#1a1a2e' }}>English</option>
                  <option value="es" style={{ background: '#1a1a2e' }}>Spanish</option>
                  <option value="fr" style={{ background: '#1a1a2e' }}>French</option>
                  <option value="de" style={{ background: '#1a1a2e' }}>German</option>
                  <option value="it" style={{ background: '#1a1a2e' }}>Italian</option>
                  <option value="pt" style={{ background: '#1a1a2e' }}>Portuguese</option>
                  <option value="ru" style={{ background: '#1a1a2e' }}>Russian</option>
                  <option value="zh" style={{ background: '#1a1a2e' }}>Chinese</option>
                  <option value="ja" style={{ background: '#1a1a2e' }}>Japanese</option>
                  <option value="ko" style={{ background: '#1a1a2e' }}>Korean</option>
                </select>
              </div>

              {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
              {success && <div className="success-message" style={{ marginBottom: '16px', color: '#4ade80' }}>{success}</div>}
              
              <Button variant="primary" onClick={handleSave} className="save-btn" loading={saving} disabled={saving}>
                Save Changes
              </Button>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="settings-section">
              <h2>Privacy Settings</h2>
              
              <div className="toggle-item">
                <div>
                  <label>Public Profile</label>
                  <p>Allow others to view your profile</p>
                </div>
                <button 
                  className={`toggle-switch ${settings.profilePublic ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, profilePublic: !settings.profilePublic })}
                >
                  <span className="toggle-knob"></span>
                </button>
              </div>

              <div className="toggle-item">
                <div>
                  <label>Chat Messages</label>
                  <p>Allow others to send you messages</p>
                </div>
                <button 
                  className={`toggle-switch ${settings.chatEnabled ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, chatEnabled: !settings.chatEnabled })}
                >
                  <span className="toggle-knob"></span>
                </button>
              </div>

              <div style={{ 
                marginTop: '24px',
                padding: '16px',
                background: 'rgba(241, 91, 181, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(241, 91, 181, 0.3)'
              }}>
                <h4 style={{ color: '#F15BB5', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={18} />
                  Danger Zone
                </h4>
                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', marginBottom: '16px' }}>
                  These actions cannot be undone.
                </p>
                {showDeleteConfirm && (
                  <p style={{ fontSize: '0.85rem', color: '#F15BB5', marginBottom: '12px', fontWeight: 600 }}>
                    ⚠️ Are you sure? This will permanently delete your account!
                  </p>
                )}
                <Button 
                  variant="secondary" 
                  onClick={handleDeleteAccount}
                  loading={saving}
                  disabled={saving}
                  style={{ 
                    width: '100%',
                    background: showDeleteConfirm ? 'rgba(239, 68, 68, 0.3)' : 'rgba(241, 91, 181, 0.2)',
                    color: showDeleteConfirm ? '#ef4444' : '#F15BB5',
                    borderColor: showDeleteConfirm ? 'rgba(239, 68, 68, 0.5)' : 'rgba(241, 91, 181, 0.3)'
                  }}
                >
                  {showDeleteConfirm ? 'Click again to confirm deletion' : 'Delete Account'}
                </Button>
                {showDeleteConfirm && (
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{ 
                      width: '100%',
                      marginTop: '8px'
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>

              {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
              {success && <div className="success-message" style={{ marginBottom: '16px', color: '#4ade80' }}>{success}</div>}
              
              <Button variant="primary" onClick={handleSave} className="save-btn" loading={saving} disabled={saving}>
                Save Changes
              </Button>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="settings-section">
              <h2>Notification Settings</h2>
              
              <div className="toggle-item">
                <div>
                  <label>Push Notifications</label>
                  <p>Receive notifications in browser</p>
                </div>
                <button 
                  className={`toggle-switch ${settings.notifications ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, notifications: !settings.notifications })}
                >
                  <span className="toggle-knob"></span>
                </button>
              </div>

              <div className="toggle-item">
                <div>
                  <label>Email Notifications</label>
                  <p>Receive updates via email</p>
                </div>
                <button 
                  className={`toggle-switch ${settings.emailNotifications ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, emailNotifications: !settings.emailNotifications })}
                >
                  <span className="toggle-knob"></span>
                </button>
              </div>

              <div className="toggle-item">
                <div>
                  <label>Game Invites</label>
                  <p>Get notified when invited to a game</p>
                </div>
                <button 
                  className={`toggle-switch ${settings.gameInvites ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, gameInvites: !settings.gameInvites })}
                >
                  <span className="toggle-knob"></span>
                </button>
              </div>

              <div className="toggle-item">
                <div>
                  <label>Friend Requests</label>
                  <p>Get notified of new friend requests</p>
                </div>
                <button 
                  className={`toggle-switch ${settings.friendRequests ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, friendRequests: !settings.friendRequests })}
                >
                  <span className="toggle-knob"></span>
                </button>
              </div>

              {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
              {success && <div className="success-message" style={{ marginBottom: '16px', color: '#4ade80' }}>{success}</div>}
              
              <Button variant="primary" onClick={handleSave} className="save-btn" loading={saving} disabled={saving}>
                Save Changes
              </Button>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

// Add global type declarations
declare global {
  interface Window {
    __SOUND_ENABLED__: boolean;
    __MUSIC_ENABLED__: boolean;
    __HAPTIC_ENABLED__: boolean;
    __CHAT_ENABLED__: boolean;
    __NOTIFICATIONS_ENABLED__: boolean;
  }
}
