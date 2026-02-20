import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'midnight' | 'ocean' | 'sunset' | 'forest';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const themes: Record<Theme, Record<string, string>> = {
  midnight: {
    '--bg-primary': '#0f0f1a',
    '--bg-secondary': '#1a1a2e',
    '--bg-tertiary': '#16213e',
    '--accent-primary': '#8b5cf6',
    '--accent-secondary': '#06b6d4',
    '--accent-tertiary': '#ec4899',
    '--text-primary': '#ffffff',
    '--text-secondary': 'rgba(255,255,255,0.7)',
    '--text-muted': 'rgba(255,255,255,0.5)',
    '--glass-bg': 'rgba(255, 255, 255, 0.03)',
    '--glass-border': 'rgba(255, 255, 255, 0.1)',
    '--success': '#10b981',
    '--warning': '#f59e0b',
    '--error': '#ef4444',
  },
  ocean: {
    '--bg-primary': '#0c1e3d',
    '--bg-secondary': '#1a3a5c',
    '--bg-tertiary': '#0f2744',
    '--accent-primary': '#0ea5e9',
    '--accent-secondary': '#06b6d4',
    '--accent-tertiary': '#22d3ee',
    '--text-primary': '#ffffff',
    '--text-secondary': 'rgba(255,255,255,0.7)',
    '--text-muted': 'rgba(255,255,255,0.5)',
    '--glass-bg': 'rgba(14, 165, 233, 0.08)',
    '--glass-border': 'rgba(14, 165, 233, 0.2)',
    '--success': '#10b981',
    '--warning': '#f59e0b',
    '--error': '#ef4444',
  },
  sunset: {
    '--bg-primary': '#2d1b2e',
    '--bg-secondary': '#4a192c',
    '--bg-tertiary': '#1f1a2e',
    '--accent-primary': '#f97316',
    '--accent-secondary': '#ec4899',
    '--accent-tertiary': '#fbbf24',
    '--text-primary': '#ffffff',
    '--text-secondary': 'rgba(255,255,255,0.7)',
    '--text-muted': 'rgba(255,255,255,0.5)',
    '--glass-bg': 'rgba(249, 115, 22, 0.08)',
    '--glass-border': 'rgba(249, 115, 22, 0.2)',
    '--success': '#10b981',
    '--warning': '#f59e0b',
    '--error': '#ef4444',
  },
  forest: {
    '--bg-primary': '#0f291e',
    '--bg-secondary': '#1a3d2e',
    '--bg-tertiary': '#0f2419',
    '--accent-primary': '#10b981',
    '--accent-secondary': '#34d399',
    '--accent-tertiary': '#84cc16',
    '--text-primary': '#ffffff',
    '--text-secondary': 'rgba(255,255,255,0.7)',
    '--text-muted': 'rgba(255,255,255,0.5)',
    '--glass-bg': 'rgba(16, 185, 129, 0.08)',
    '--glass-border': 'rgba(16, 185, 129, 0.2)',
    '--success': '#10b981',
    '--warning': '#f59e0b',
    '--error': '#ef4444',
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('kribble-theme') as Theme;
    return saved || 'midnight';
  });

  useEffect(() => {
    const root = document.documentElement;
    const themeVars = themes[theme];
    
    Object.entries(themeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    localStorage.setItem('kribble-theme', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    const themeOrder: Theme[] = ['midnight', 'ocean', 'sunset', 'forest'];
    const currentIndex = themeOrder.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    setThemeState(themeOrder[nextIndex]);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
