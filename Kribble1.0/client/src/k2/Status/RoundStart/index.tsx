// @ts-nocheck
import React from 'react';

import texts from '../../constants/texts';
import { useGame } from '../../contexts/game';

const RoundStart = () => {
  const { game } = useGame();
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'rgba(26, 26, 46, 0.8)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '2rem',
      }}
    >
      <div
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: '#ffffff',
          textAlign: 'center',
          marginBottom: '1rem',
        }}
      >
        {texts.game.roundStart.title + game.options.round.current}
      </div>
      <div
        style={{
          fontSize: '1rem',
          color: 'rgba(255, 255, 255, 0.6)',
          textAlign: 'center',
        }}
      >
        Get ready to draw and guess!
      </div>
    </div>
  );
};

export default RoundStart;
