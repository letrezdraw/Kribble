import React, { HTMLAttributes } from 'react';

const Bubble = (props: Omit<HTMLAttributes<HTMLDivElement>, 'className'>) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid var(--chalk-white)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.75rem',
        width: '100%',
        color: 'var(--chalk-white)',
      }}
      {...props}
    />
  );
};

export default Bubble;
