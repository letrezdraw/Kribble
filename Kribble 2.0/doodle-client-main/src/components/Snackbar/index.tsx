import { useEffect, useRef } from 'react';
import { X } from 'react-feather';

import { ColorType } from '@/types/styles';

const colorMap: Record<ColorType, { bg: string; border: string }> = {
  primary: { bg: 'var(--chalk-white)', border: 'var(--chalk-white)' },
  secondary: { bg: 'var(--chalk-blue)', border: 'var(--chalk-blue)' },
  success: { bg: 'var(--chalk-green)', border: 'var(--chalk-green)' },
  error: { bg: 'var(--chalk-pink)', border: 'var(--chalk-pink)' },
  warning: { bg: 'var(--chalk-yellow)', border: 'var(--chalk-yellow)' },
};

interface SnackbarOptions {
  open: boolean;
  message: string;
  handleClose: () => void;
  color?: ColorType;
  isInfinite: boolean;
  duration: number;
  timestamp: number;
}

const Snackbar = ({
  open,
  message,
  handleClose,
  isInfinite,
  duration,
  timestamp,
  color = 'primary',
}: SnackbarOptions) => {
  const colorStyle = colorMap[color];
  const requestId = useRef<number>();
  const progressRef = useRef<HTMLDivElement>(null);

  const handleAnimation = () => {
    const diff = Date.now() - timestamp;
    if (progressRef.current)
      progressRef.current.style.width = (diff * 100) / duration + '%';
    requestId.current = window.requestAnimationFrame(handleAnimation);
  };

  useEffect(() => {
    requestId.current = window.requestAnimationFrame(handleAnimation);

    return () => {
      requestId.current && window.cancelAnimationFrame(requestId.current);
    };
  }, [timestamp]);

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        bottom: 0,
        margin: '1.25rem',
        zIndex: 50,
        maxWidth: '100%',
        transition: 'all 250ms ease',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: colorStyle.bg,
        color: 'var(--board-green)',
        opacity: open ? 1 : 0,
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        pointerEvents: open ? 'auto' : 'none',
        visibility: open ? 'visible' : 'hidden',
      }}
    >
      <div style={{ position: 'relative' }}>
        <button
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            margin: '0.5rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={handleClose}
        >
          <X style={{ stroke: 'var(--board-green)' }} size={18} />
        </button>
      </div>
      <p style={{ padding: '1.25rem 2rem' }}>{message}</p>
      {open && !isInfinite && (
        <div
          ref={progressRef}
          style={{
            height: '4px',
            background: 'var(--board-green)',
            transition: 'width 0.1s linear',
          }}
        />
      )}
    </div>
  );
};

export default Snackbar;
