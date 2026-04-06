import type { Theme } from '../contexts/ThemeContext';

export interface AppSettings {
  username: string;
  email: string;
  theme: Theme;
  sound: boolean;
  music: boolean;
  notifications: boolean;
  emailNotifications: boolean;
  profilePublic: boolean;
  chatEnabled: boolean;
  language: string;
  haptic: boolean;
  gameInvites: boolean;
  friendRequests: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  username: '',
  email: '',
  theme: 'midnight',
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
  reducedMotion: false,
};

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem('kribble_settings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore invalid local state and fall back to defaults.
  }

  return DEFAULT_SETTINGS;
}

export function saveSettingsToStorage(settings: AppSettings): void {
  try {
    localStorage.setItem('kribble_settings', JSON.stringify(settings));
  } catch {
    // Ignore storage failures.
  }
}

export function applySettings(settings: AppSettings): void {
  window.__SOUND_ENABLED__ = settings.sound;
  window.__MUSIC_ENABLED__ = settings.music;
  window.__HAPTIC_ENABLED__ = settings.haptic;
  window.__CHAT_ENABLED__ = settings.chatEnabled;
  window.__NOTIFICATIONS_ENABLED__ = settings.notifications;
  document.body.setAttribute('data-chat-enabled', String(settings.chatEnabled));
  document.body.setAttribute('data-reduced-motion', String(settings.reducedMotion));

  const audio = document.getElementById('bg-music') as HTMLAudioElement | null;
  if (audio) {
    if (settings.music) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }
}

export function getPersistedSettingsPayload(settings: AppSettings) {
  return {
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
    reducedMotion: settings.reducedMotion,
  };
}
