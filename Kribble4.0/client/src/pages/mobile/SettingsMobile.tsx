import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Moon, Volume2, Bell, Palette, LogOut, ChevronRight, User, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, type Theme } from '../../contexts/ThemeContext';
import api from '../../services/api';
import {
  applySettings,
  getPersistedSettingsPayload,
  loadSettings,
  saveSettingsToStorage,
} from '../../utils/settings';
import './SettingsMobile.css';

export default function SettingsMobile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const [settings, setSettings] = useState(() => {
    const loaded = loadSettings();
    return {
      ...loaded,
      theme,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    applySettings(settings);
    setTheme(settings.theme);
    saveSettingsToStorage(settings);
  }, [settings, setTheme]);

  useEffect(() => {
    if (!user?.id) return;

    const fetchSettings = async () => {
      try {
        const response = await api.get(`/users/${user.id}/settings`);
        setSettings(prev => ({
          ...prev,
          ...response.data.settings,
          theme: (response.data.settings?.theme || prev.theme) as Theme,
        }));
      } catch {
        // Keep local settings.
      }
    };

    fetchSettings();
  }, [user?.id]);

  const persistSettings = async (nextSettings: typeof settings) => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      saveSettingsToStorage(nextSettings);
      applySettings(nextSettings);
      setTheme(nextSettings.theme);

      if (user?.id) {
        await api.put(`/users/${user.id}/settings`, {
          settings: getPersistedSettingsPayload(nextSettings),
        });
      }

      setSuccess('Saved');
      window.setTimeout(() => setSuccess(''), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = async <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    await persistSettings(nextSettings);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
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
      logout();
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete account');
      setShowDeleteConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  const settingGroups = useMemo(() => [
    {
      title: 'Appearance',
      items: [
        {
          key: 'theme',
          icon: Moon,
          label: `Theme: ${settings.theme}`,
          value: settings.theme === 'midnight',
          onClick: () => updateSetting('theme', settings.theme === 'midnight' ? 'ocean' : 'midnight'),
        },
        {
          key: 'reducedMotion',
          icon: Palette,
          label: 'Reduced Motion',
          value: settings.reducedMotion,
          onClick: () => updateSetting('reducedMotion', !settings.reducedMotion),
        },
      ],
    },
    {
      title: 'Sound & Haptics',
      items: [
        {
          key: 'sound',
          icon: Volume2,
          label: 'Sound Effects',
          value: settings.sound,
          onClick: () => updateSetting('sound', !settings.sound),
        },
        {
          key: 'haptic',
          icon: Bell,
          label: 'Vibration',
          value: settings.haptic,
          onClick: () => updateSetting('haptic', !settings.haptic),
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          key: 'notifications',
          icon: Bell,
          label: 'Push Notifications',
          value: settings.notifications,
          onClick: () => updateSetting('notifications', !settings.notifications),
        },
      ],
    },
  ], [settings]);

  return (
    <div className="settings-mobile-compact">
      <header className="settings-header-compact">
        <button className="icon-btn-compact" onClick={() => navigate('/lobby')}>
          <ArrowLeft size={20} />
        </button>
        <h1>Settings</h1>
        <div style={{ width: 40 }} />
      </header>

      <div className="user-card-compact">
        <div className="user-avatar-large">{user?.avatarId || '👤'}</div>
        <div className="user-details-compact">
          <h2>{user?.username || 'Player'}</h2>
          <p>{user?.email || 'Guest account'}</p>
        </div>
        <button className="edit-btn-compact" onClick={() => navigate('/profile')}>
          <User size={18} />
        </button>
      </div>

      <div className="settings-groups">
        {settingGroups.map((group, groupIndex) => (
          <motion.div
            key={group.title}
            className="setting-group-compact"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groupIndex * 0.1 }}
          >
            <h3 className="group-title">{group.title}</h3>
            <div className="group-items">
              {group.items.map((item) => (
                <div key={item.key} className="setting-item-compact">
                  <div className="item-left">
                    <div className="item-icon">
                      <item.icon size={18} />
                    </div>
                    <span className="item-label">{item.label}</span>
                  </div>
                  <button
                    className={`toggle-compact ${item.value ? 'active' : ''}`}
                    onClick={item.onClick}
                    disabled={saving}
                  >
                    <div className="toggle-knob" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        ))}

        <motion.div
          className="setting-group-compact"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="group-title">Account</h3>
          <div className="group-items">
            <button className="setting-item-compact action-item" onClick={handleLogout}>
              <div className="item-left">
                <div className="item-icon danger">
                  <LogOut size={18} />
                </div>
                <span className="item-label danger-text">Log Out</span>
              </div>
              <ChevronRight size={18} className="chevron" />
            </button>

            <button className="setting-item-compact action-item" onClick={handleDeleteAccount} disabled={saving}>
              <div className="item-left">
                <div className="item-icon danger">
                  <Trash2 size={18} />
                </div>
                <span className="item-label danger-text">
                  {showDeleteConfirm ? 'Tap again to delete account' : 'Delete Account'}
                </span>
              </div>
              <ChevronRight size={18} className="chevron" />
            </button>
          </div>
        </motion.div>

        {error && <div className="settings-inline-message error">{error}</div>}
        {success && <div className="settings-inline-message success">{success}</div>}
      </div>

      <footer className="settings-footer-compact">
        <p>Kribble v4.0.0</p>
        <div className="footer-links">
          <button type="button">Privacy</button>
          <span>•</span>
          <button type="button">Terms</button>
          <span>•</span>
          <button type="button">Help</button>
        </div>
      </footer>
    </div>
  );
}
