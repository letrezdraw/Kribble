import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Bell, Shield, Palette } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type Theme } from '../contexts/ThemeContext';
import api from '../services/api';
import Button from '../components/Button';
import {
  DEFAULT_SETTINGS,
  applySettings,
  getPersistedSettingsPayload,
  loadSettings,
  saveSettingsToStorage,
} from '../utils/settings';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'privacy' | 'notifications'>('account');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [settings, setSettings] = useState(() => {
    const loaded = loadSettings();
    return {
      ...loaded,
      theme,
      username: user?.username || loaded.username || '',
      email: user?.email || loaded.email || '',
    };
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    applySettings(settings);
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const fetchSettings = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/users/${user.id}/settings`);
        const nextSettings = {
          ...DEFAULT_SETTINGS,
          ...loadSettings(),
          ...response.data.settings,
          theme: (response.data.settings?.theme || theme) as Theme,
          username: user.username || '',
          email: user.email || '',
        };
        setSettings(nextSettings);
        applySettings(nextSettings);
        setTheme(nextSettings.theme);
      } catch {
        // Fall back to local state.
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user?.id]);

  useEffect(() => {
    saveSettingsToStorage(settings);
    applySettings(settings);
    setTheme(settings.theme);
  }, [settings, setTheme]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      saveSettingsToStorage(settings);
      applySettings(settings);
      setTheme(settings.theme);

      if (user?.id && settings.username.trim() && settings.username !== user.username) {
        const response = await api.put('/auth/profile', {
          username: settings.username.trim(),
        });
        updateUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }

      if (user?.id) {
        await api.put(`/users/${user.id}/settings`, {
          settings: getPersistedSettingsPayload(settings),
        });
      }

      setSuccess('Settings saved successfully.');
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
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setSuccess('Password changed successfully.');
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
      <header className="settings-header">
        <Button variant="ghost" size="sm" onClick={() => navigate('/profile')}>
          <ArrowLeft size={20} />
        </Button>
        <h1>Settings</h1>
        <div style={{ width: 40 }} />
      </header>

      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

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
                  readOnly
                  disabled
                  placeholder="Email cannot be changed yet"
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

              <Button variant="primary" onClick={handleSave} className="save-btn" loading={saving || loading} disabled={saving}>
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
                  <span className="toggle-knob" />
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
                  <span className="toggle-knob" />
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
                  <span className="toggle-knob" />
                </button>
              </div>

              <div className="toggle-item">
                <div>
                  <label>Reduced Motion</label>
                  <p>Reduce non-essential motion effects</p>
                </div>
                <button
                  className={`toggle-switch ${settings.reducedMotion ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, reducedMotion: !settings.reducedMotion })}
                >
                  <span className="toggle-knob" />
                </button>
              </div>

              <div className="form-group" style={{ marginTop: '24px' }}>
                <label>Theme</label>
                <select
                  value={settings.theme}
                  onChange={(e) => setSettings({ ...settings, theme: e.target.value as Theme })}
                  className="settings-select"
                >
                  <option value="midnight">Midnight</option>
                  <option value="ocean">Ocean</option>
                  <option value="sunset">Sunset</option>
                  <option value="forest">Forest</option>
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '24px' }}>
                <label>Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                  className="settings-select"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ru">Russian</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                </select>
              </div>

              {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
              {success && <div className="success-message" style={{ marginBottom: '16px', color: '#4ade80' }}>{success}</div>}

              <Button variant="primary" onClick={handleSave} className="save-btn" loading={saving || loading} disabled={saving}>
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
                  <span className="toggle-knob" />
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
                  <span className="toggle-knob" />
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
                    Are you sure? This will permanently delete your account.
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
                  <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} style={{ width: '100%', marginTop: '8px' }}>
                    Cancel
                  </Button>
                )}
              </div>

              {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
              {success && <div className="success-message" style={{ marginBottom: '16px', color: '#4ade80' }}>{success}</div>}

              <Button variant="primary" onClick={handleSave} className="save-btn" loading={saving || loading} disabled={saving}>
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
                  <span className="toggle-knob" />
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
                  <span className="toggle-knob" />
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
                  <span className="toggle-knob" />
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
                  <span className="toggle-knob" />
                </button>
              </div>

              {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
              {success && <div className="success-message" style={{ marginBottom: '16px', color: '#4ade80' }}>{success}</div>}

              <Button variant="primary" onClick={handleSave} className="save-btn" loading={saving || loading} disabled={saving}>
                Save Changes
              </Button>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
