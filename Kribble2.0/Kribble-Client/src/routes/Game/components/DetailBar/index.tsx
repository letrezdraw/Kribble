import { useEffect, useRef, useState } from 'react';
import { GiAlarmClock } from 'react-icons/gi';
import { Link } from 'react-router-dom';

import Text from '@/components/Text';
import { useGame } from '@/contexts/game';
import { useRoom } from '@/contexts/room';
import { useUser } from '@/contexts/user';
import { GameOptions, GameStatus } from '@/types/models/game';

const DetailBar = () => {
  const { game } = useGame();
  const { room } = useRoom();
  const { user } = useUser();
  const [key, setKey] = useState<keyof GameOptions['timers']>();
  const [currentTime, setCurrentTime] = useState(0);
  const timerRef = useRef<NodeJS.Timer | null>(null);
  const shouldDisplay =
    game.status === GameStatus.GAME ||
    (game.status === GameStatus.CHOOSE_WORD && user.id === room.drawerId);

  useEffect(() => {
    if (game.status === GameStatus.GAME) {
      setKey('drawing');
    } else if (game.status === GameStatus.TURN_END) {
      setKey('turnEndCooldownTime');
    } else if (game.status === GameStatus.CHOOSE_WORD) {
      setKey('chooseWordTime');
    } else if (game.status === GameStatus.ROUND_START) {
      setKey('roundStartCooldownTime');
    } else if (game.status === GameStatus.RESULT) {
      setKey('resultCooldownTime');
    } else setKey(undefined);
  }, [game.status]);

  const startTimer = (key: keyof GameOptions['timers']) => {
    setCurrentTime(game.options.timers[key].max);
    timerRef.current = setInterval(() => {
      setCurrentTime((prev) => prev - 1);
    }, 1000);
  };

  const resetTimer = () => {
    setCurrentTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    resetTimer();
    let t: NodeJS.Timeout | undefined = undefined;
    if (key) {
      startTimer(key);
      t = setTimeout(resetTimer, game.options.timers[key].max * 1000);
    }
    return () => {
      clearTimeout(t);
    };
  }, [key]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          width: '100%',
          height: '100%',
          maxHeight: '13vh',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Timer */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '0.5rem',
            color:
              shouldDisplay && currentTime <= 10
                ? '#ff5e5e'
                : 'rgba(255, 255, 255, 0.9)',
            animation:
              shouldDisplay && currentTime <= 10
                ? 'pulse 1s ease-in-out infinite'
                : 'none',
            fontSize: '1.5rem',
            fontWeight: 700,
          }}
        >
          <GiAlarmClock size={28} />
          <span>{shouldDisplay ? currentTime : 0}s</span>
        </div>

        {/* Word Display */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem',
            flex: 1,
            padding: '0 1rem',
            flexWrap: 'wrap',
          }}
        >
          {game.options.word.split('').map((ch, index) => (
            <span
              key={index}
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: ch === '_' ? 'rgba(255, 255, 255, 0.3)' : '#ffffff',
                minWidth: ch === ' ' ? '0.5rem' : '1.5rem',
                textAlign: 'center',
                borderBottom:
                  ch === '_' ? '2px solid rgba(255, 255, 255, 0.3)' : 'none',
                marginRight: ch === ' ' ? '0.75rem' : '0',
              }}
            >
              {ch === '_' ? '' : ch === ' ' ? '\u00A0' : ch}
            </span>
          ))}
        </div>

        {/* Round Info */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
            background: 'rgba(139, 92, 246, 0.2)',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }}
        >
          <Text
            style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}
          >
            ROUND
          </Text>
          <div
            style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}
          >
            {game.options.round.current} / {game.options.round.max}
          </div>
          <Link
            to="/profile"
            style={{
              fontSize: '0.7rem',
              color: 'rgba(255, 255, 255, 0.45)',
              textDecoration: 'none',
            }}
          >
            Profile
          </Link>
        </div>
      </div>
    </div>
  );
};
export default DetailBar;
