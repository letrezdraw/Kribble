import {
  ChangeEventHandler,
  HTMLAttributes,
  KeyboardEventHandler,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';

import { GameEvents } from '@/constants/Events';
import { useRoom } from '@/contexts/room';
import { useSnackbar } from '@/contexts/snackbar';
import { useSocket } from '@/contexts/socket';
import { HunchInterface } from '@/types/models/hunch';

import Hunch from './Hunch';

const HunchList = (props: HTMLAttributes<HTMLDivElement>) => {
  const { room } = useRoom();
  const { asyncEmitEvent, registerEvent, unregisterEvent } = useSocket();
  const { openSnackbar } = useSnackbar();
  const { roomId } = useParams();
  const listRef = useRef<HTMLUListElement>(null);
  const [hunch, setHunch] = useState('');
  const [hunchList, setHunchList] = useState<HunchInterface[]>([
    { isSystemMessage: true, message: 'Type your guess and press Enter!' },
  ]);

  const handleSendHunch: KeyboardEventHandler<HTMLInputElement> = async (e) => {
    if (e.key !== 'Enter' || !hunch.trim()) return;

    // Use roomId from URL params as fallback
    const currentRoomId = room.id || roomId;

    if (!currentRoomId) {
      openSnackbar({
        message: 'Room not found. Please try rejoining.',
        color: 'error',
      });
      return;
    }

    try {
      const data = await asyncEmitEvent(GameEvents.EMIT_GAME_HUNCH, {
        roomId: currentRoomId,
        message: hunch.trim(),
      });
      handleOnReceiveHunch(data);
      setHunch('');
    } catch (error) {
      console.error('Failed to send hunch:', error);
      openSnackbar({
        message: 'Failed to send message. Please try again.',
        color: 'error',
      });
    }
  };

  const handleChangeHunch: ChangeEventHandler<HTMLInputElement> = (e) => {
    setHunch(e.target.value);
  };

  const handleOnReceiveHunch = ({
    hunch: hunchResponse,
  }: {
    hunch: HunchInterface;
  }) => {
    setHunchList((prev) => [...prev, hunchResponse]);
  };

  useEffect(() => {
    listRef.current?.scrollTo({
      behavior: 'smooth',
      top: listRef.current.scrollHeight,
    });
  }, [hunchList]);

  useEffect(() => {
    registerEvent(GameEvents.ON_GAME_HUNCH, handleOnReceiveHunch);
    return () => {
      unregisterEvent(GameEvents.ON_GAME_HUNCH, handleOnReceiveHunch);
    };
  }, []);

  return (
    <div {...props} style={{ height: '100%', ...props.style }}>
      <div
        style={{
          padding: '0.75rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        <h2
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.8)',
            marginBottom: '0.5rem',
            paddingBottom: '0.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Chat & Guesses</span>
          <span
            style={{
              background: 'rgba(6, 182, 212, 0.3)',
              color: '#fff',
              padding: '0.125rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
            }}
          >
            {hunchList.length - 1}
          </span>
        </h2>
        <ul
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            padding: '0.5rem 0',
            listStyle: 'none',
          }}
        >
          {hunchList.map((hunch, index) => (
            <Hunch
              hunch={hunch}
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                marginTop: '0.25rem',
                marginBottom: '0.25rem',
                borderRadius: '8px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                hyphens: 'none',
                justifyContent: hunch.isSystemMessage ? 'center' : 'flex-start',
                padding: hunch.isSystemMessage ? '0.5rem' : '0.25rem 0',
                background: hunch.isSystemMessage
                  ? 'rgba(139, 92, 246, 0.1)'
                  : 'transparent',
                fontSize: '0.875rem',
              }}
            />
          ))}
        </ul>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            marginTop: '0.5rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <input
            type="text"
            value={hunch}
            placeholder="Type your guess here..."
            style={{
              width: '100%',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem',
              outline: 'none',
              fontSize: '0.875rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
            }}
            onKeyDown={handleSendHunch}
            onChange={handleChangeHunch}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
            }}
          />
          <p
            style={{
              fontSize: '0.75rem',
              color: 'rgba(255, 255, 255, 0.4)',
              textAlign: 'center',
            }}
          >
            Press Enter to send
          </p>
        </div>
      </div>
    </div>
  );
};

export default HunchList;
