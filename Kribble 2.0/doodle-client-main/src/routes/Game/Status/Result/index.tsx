import React, { useEffect } from 'react';

import texts from '@/constants/texts';
import { useRoom } from '@/contexts/room';

interface ResultProps {
  results?: Record<string, number>;
}

const Result = ({ results }: ResultProps) => {
  const { room, setRoom } = useRoom();

  const doodlersWithScores = room.doodlers
    .map((doodler) => ({
      ...doodler,
      score: results?.[doodler.id] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  // Reset the scores
  useEffect(() => {
    setRoom((prev) => ({
      ...prev,
      doodlers: prev.doodlers.map((d) => ({ ...d, score: 0 })),
    }));
  }, []);

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
          fontSize: '1.75rem',
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}
      >
        {texts.game.result.title}
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
              key={`result-${doodler.id}`}
              style={{
                background:
                  index === 0
                    ? 'rgba(139, 92, 246, 0.2)'
                    : index === 1
                    ? 'rgba(6, 182, 212, 0.15)'
                    : index === 2
                    ? 'rgba(236, 72, 153, 0.15)'
                    : 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <td
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  color:
                    index === 0
                      ? '#8b5cf6'
                      : index === 1
                      ? '#06b6d4'
                      : index === 2
                      ? '#ec4899'
                      : 'rgba(255, 255, 255, 0.6)',
                }}
              >
                #{index + 1}
              </td>
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
                {doodler.score}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Result;
