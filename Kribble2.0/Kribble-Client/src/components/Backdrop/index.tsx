import { PropsWithChildren, useEffect } from 'react';
import { createPortal } from 'react-dom';

const Backdrop = ({ children }: PropsWithChildren) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return createPortal(
    <div
      className="backdrop"
      style={{
        zIndex: 40,
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        color: 'var(--chalk-green)',
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {children}
    </div>,
    document.body
  );
};
export default Backdrop;
