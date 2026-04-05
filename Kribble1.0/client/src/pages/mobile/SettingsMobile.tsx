import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Moon, Volume2, Bell, Palette, Shield, LogOut, ChevronRight, User, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/Button';
import './SettingsMobile.css';



export default function SettingsMobile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState({
    darkMode: true,
    sound: true,
    notifications: true,
    vibration: true,
    reducedMotion: false,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const settingGroups = [
    {
      title: 'Appearance',
      items: [
        { key: 'darkMode', icon: Moon, label: 'Dark Mode', value: settings.darkMode },
        { key: 'reducedMotion', icon: Palette, label: 'Reduced Motion', value: settings.reducedMotion },
      ],
    },
    {
      title: 'Sound & Haptics',
      items: [
        { key: 'sound', icon: Volume2, label: 'Sound Effects', value: settings.sound },
        { key: 'vibration', icon: Bell, label: 'Vibration', value: settings.vibration },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { key: 'notifications', icon: Bell, label: 'Push Notifications', value: settings.notifications },
      ],
    },
  ];

  return (
    <div className="settings-mobile-compact">
      {/* Sticky Header */}
      <header className="settings-header-compact">
        <button className="icon-btn-compact" onClick={() => navigate('/lobby')}>
          <ArrowLeft size={20} />
        </button>
        <h1>Settings</h1>
        <div style={{ width: 40 }} />
      </header>

      {/* User Card */}
      <div className="user-card-compact">
        <div className="user-avatar-large">{user?.avatarId || '👤'}</div>
        <div className="user-details-compact">
          <h2>{user?.username || 'Player'}</h2>
          <p>{user?.email || 'player@kribble.com'}</p>
        </div>
        <button className="edit-btn-compact" onClick={() => navigate('/profile')}>
          <User size={18} />
        </button>
      </div>

      {/* Settings Groups */}
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
                    onClick={() => toggleSetting(item.key as keyof typeof settings)}
                  >
                    <div className="toggle-knob" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        ))}

        {/* Account Actions */}
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
            
            <button className="setting-item-compact action-item">
              <div className="item-left">
                <div className="item-icon danger">
                  <Trash2 size={18} />
                </div>
                <span className="item-label danger-text">Delete Account</span>
              </div>
              <ChevronRight size={18} className="chevron" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* App Info */}
      <footer className="settings-footer-compact">
        <p>Kribble v1.0.0</p>
        <div className="footer-links">
          <button>Privacy</button>
          <span>•</span>
          <button>Terms</button>
          <span>•</span>
          <button>Help</button>
        </div>
      </footer>
    </div>
  );
}
