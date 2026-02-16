import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Bell, Shield, Palette, Volume2, Moon, Globe, Smartphone, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'privacy' | 'notifications'>('account');
  
  const [settings, setSettings] = useState({
    username: user?.username || '',
    email: user?.email || '',
    theme: 'dark',
    sound: true,
    music: true,
    notifications: true,
    emailNotifications: false,
    profilePublic: true,
    chatEnabled: true,
    language: 'en',
    haptic: true,
  });

  const handleSave = () => {
    console.log('Saving settings:', settings);
    // Save settings logic
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
                  style={{ marginBottom: '12px' }}
                />
                <input 
                  type="password" 
                  placeholder="New password"
                />
              </div>

              <Button variant="primary" onClick={handleSave} className="save-btn">
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
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Globe size={20} color="rgba(255,255,255,0.6)" />
                    <span>English</span>
                  </div>
                  <ChevronRight size={20} color="rgba(255,255,255,0.4)" />
                </div>
              </div>

              <Button variant="primary" onClick={handleSave} className="save-btn">
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
                <Button variant="secondary" style={{ 
                  width: '100%',
                  background: 'rgba(241, 91, 181, 0.2)',
                  color: '#F15BB5',
                  borderColor: 'rgba(241, 91, 181, 0.3)'
                }}>
                  Delete Account
                </Button>
              </div>

              <Button variant="primary" onClick={handleSave} className="save-btn">
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
                  className={`toggle-switch active`}
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
                  className={`toggle-switch active`}
                >
                  <span className="toggle-knob"></span>
                </button>
              </div>

              <Button variant="primary" onClick={handleSave} className="save-btn">
                Save Changes
              </Button>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
