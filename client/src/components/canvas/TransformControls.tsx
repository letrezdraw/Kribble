import './TransformControls.css';
import type { Transform } from './types';

interface TransformControlsProps {
  transform: Transform;
  show: boolean;
  onToggle: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onRotate: (direction: 'cw' | 'ccw') => void;
}

export function TransformControls({
  transform,
  show,
  onToggle,
  onZoomIn,
  onZoomOut,
  onReset,
  onRotate,
}: TransformControlsProps) {
  return (
    <div className="transform-controls-container">
      <button className="transform-toggle" onClick={onToggle} title="View Controls">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m17.8 17.8l-4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.07-4.93l-4.24 4.24M6.34 6.34l-4.24-4.24"/>
        </svg>
      </button>

      {show && (
        <div className="transform-panel">
          <div className="transform-section">
            <span className="transform-label">Zoom</span>
            <div className="transform-buttons">
              <button className="transform-btn" onClick={onZoomOut} title="Zoom Out">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35M8 11h6"/>
                </svg>
              </button>
              <span className="transform-value">{Math.round(transform.scale * 100)}%</span>
              <button className="transform-btn" onClick={onZoomIn} title="Zoom In">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="transform-section">
            <span className="transform-label">Rotate</span>
            <div className="transform-buttons">
              <button className="transform-btn" onClick={() => onRotate('ccw')} title="Rotate Left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5"/>
                </svg>
              </button>
              <button className="transform-btn reset" onClick={onReset} title="Reset View">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
              <button className="transform-btn" onClick={() => onRotate('cw')} title="Rotate Right">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="transform-hint">
            <span>Space+Drag to pan</span>
            <span>•</span>
            <span>Wheel to zoom</span>
          </div>
        </div>
      )}
    </div>
  );
}
