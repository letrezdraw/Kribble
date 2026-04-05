import { PropsWithChildren, ReactNode } from 'react';

import Backdrop from '../Backdrop';
import Text from '../Text';

interface DialogProps extends PropsWithChildren {
  visible: boolean;
  onClose?: () => void;
  title?: string;
  footer?: ReactNode;
}

const Dialog = ({ visible, onClose, title, footer, children }: DialogProps) => {
  if (!visible) return null;

  return (
    <Backdrop>
      <div
        style={{
          zIndex: 40,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'var(--board-green-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '2.5rem',
        }}
        onClick={onClose}
        tabIndex={0}
        autoFocus
      >
        <div
          style={{
            width: '100%',
            maxWidth: '600px',
            margin: '2.5rem',
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <Text component="h3" style={{ textAlign: 'center' }}>
              {title}
            </Text>
          )}
          <div
            style={{
              alignSelf: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            {children}
          </div>
          {footer && (
            <div
              style={{
                alignSelf: 'flex-end',
                display: 'flex',
                flexDirection: 'row',
                gap: '1rem',
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </Backdrop>
  );
};

export default Dialog;
