import { useEffect, useRef } from 'react';
import './BrushSettingsMenu.css';

interface BrushSettings {
  minSpacing: number;
  spacingMultiplier: number;
  interpolationThreshold: number;
  pressureSmoothing: number;
  showLivePreview: boolean;
}

interface BrushSettingsMenuProps {
  settings: BrushSettings;
  onSettingsChange: (settings: BrushSettings) => void;
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

const PRESETS = {
  'Smooth': {
    minSpacing: 0.1,
    spacingMultiplier: 0.02,
    interpolationThreshold: 1.01,
    pressureSmoothing: 0.35,
    showLivePreview: true,
  },
  'Fast': {
    minSpacing: 0.3,
    spacingMultiplier: 0.08,
    interpolationThreshold: 1.5,
    pressureSmoothing: 0.5,
    showLivePreview: false,
  },
};

export function BrushSettingsMenu({
  settings,
  onSettingsChange,
  isOpen,
  position,
  onClose,
}: BrushSettingsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const applyPreset = (presetName: keyof typeof PRESETS) => {
    const preset = PRESETS[presetName];
    onSettingsChange(preset);
  };

  const toggleLivePreview = () => {
    onSettingsChange({ ...settings, showLivePreview: !settings.showLivePreview });
  };

  if (!isOpen) return null;

  // Ensure menu stays within viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 200),
    top: Math.min(position.y, window.innerHeight - 150),
    zIndex: 1000,
  };

  return (
    <div ref={menuRef} className="brush-settings-menu" style={menuStyle}>
      <div className="brush-settings-header">
        <span>Brush Quality</span>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="brush-presets">
        <button
          className={`preset-btn ${settings.showLivePreview ? 'active' : ''}`}
          onClick={() => applyPreset('Smooth')}
        >
          Smooth
        </button>
        <button
          className={`preset-btn ${!settings.showLivePreview ? 'active' : ''}`}
          onClick={() => applyPreset('Fast')}
        >
          Fast
        </button>
      </div>

      <div className="brush-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.showLivePreview}
            onChange={toggleLivePreview}
          />
          <span>Live Preview</span>
        </label>
      </div>

      <div className="brush-hint">
        Right-click canvas to open
      </div>
    </div>
  );
}
