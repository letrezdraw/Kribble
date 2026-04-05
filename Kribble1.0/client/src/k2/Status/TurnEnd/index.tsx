// @ts-nocheck
import React from 'react';

import texts from '../../constants/texts';
import { useGame } from '../../contexts/game';
import { useRoom } from '../../contexts/room';

interface TurnEndProps {
  scores?: Record<string, number>;
}

const TurnEnd = ({ scores }: TurnEndProps) => {
  const { game } = useGame();
  const { room } = useRoom();

  const doodlersWithScores = room.doodlers
    .map((doodler) => ({
      ...doodler,
      score: scores?.[doodler.id] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

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
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}
      >
        {texts.game.turnEnd.title + ` "${game.options.word}"`}
      </div>
      <table
        style={{
          width: '100%',
          maxWidth: '400px',
          borderCollapse: 'separate',
          borderSpacing: '0 0.5rem',
        }}
      >
        <tbody>
          {doodlersWithScores.map((doodler, index) => (
            <tr
              key={doodler.id}
              style={{
                background:
                  index === 0
                    ? 'rgba(139, 92, 246, 0.2)'
                    : 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <td
                style={{
                  padding: '1rem',
                  fontWeight: 600,
                  color: '#ffffff',
                }}
              >
                {doodler.name}
              </td>
              <td
                style={{
                  padding: '1rem',
                  textAlign: 'right',
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  color: doodler.score > 0 ? '#a4d8b2' : '#ff5e5e',
                }}
              >
                <span>{doodler.score > 0 ? '+' : ''}</span>
                <span>{doodler.score}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TurnEnd;
