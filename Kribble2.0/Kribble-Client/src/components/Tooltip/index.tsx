import { HTMLAttributes, useState } from 'react';

interface TooltipProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
}

const Tooltip = ({ label, children, ...rest }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div style={{ position: 'relative' }} {...rest}>
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 'var(--text-xs)',
            background: 'var(--chalk-white)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <p style={{ color: 'var(--board-green-dark)', margin: 0 }}>{label}</p>
        </div>
      )}
    </div>
  );
};

export default Tooltip;
