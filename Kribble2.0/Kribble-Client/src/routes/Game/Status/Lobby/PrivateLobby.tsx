import React, {
  ChangeEventHandler,
  FormEventHandler,
  useEffect,
  useState,
} from 'react';
import { FaCheck, FaCopy, FaShare } from 'react-icons/fa6';

import Text from '@/components/Text';
import { GameEvents } from '@/constants/Events';
import { useGame } from '@/contexts/game';
import { useRoom } from '@/contexts/room';
import { useSnackbar } from '@/contexts/snackbar';
import { useSocket } from '@/contexts/socket';
import { useUser } from '@/contexts/user';
import { PrivateGameOptions } from '@/types/socket/game';

const PrivateLobby = () => {
  const {
    room: { id, ownerId },
  } = useRoom();
  const { user } = useUser();
  const { setGame } = useGame();
  const { openSnackbar } = useSnackbar();
  const { registerEvent, unregisterEvent, asyncEmitEvent } = useSocket();
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState<PrivateGameOptions>({
    drawing: 120,
    round: 3,
  });
  const isOwner = user.id === ownerId;

  const drawingTimeOptions = Array(10)
    .fill(0)
    .map((_, index) => (index + 1) * 30);

  const roundOptions = Array(10)
    .fill(0)
    .map((_, index) => index + 1);

  const handleSettingChange: ChangeEventHandler<HTMLSelectElement> = (e) => {
    setOptions((prev) => ({
      ...prev,
      [e.target.name]: Number(e.target.value),
    }));
  };

  const handleCopyRoomLink = async () => {
    const roomLink = `${window.location.origin}/?roomId=${id}`;

    try {
      await navigator.clipboard.writeText(roomLink);
      setCopied(true);
      openSnackbar({
        message: 'Room link copied to clipboard!',
        color: 'success',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      openSnackbar({
        message: 'Could not copy room link automatically.',
        color: 'error',
      });
    }
  };

  const handleShareRoom = async () => {
    const roomLink = `${window.location.origin}/?roomId=${id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Kribble room!',
          text: `Join my private Kribble room with code: ${id}`,
          url: roomLink,
        });
      } catch (_err) {
        openSnackbar({
          message: 'Share was cancelled.',
          color: 'warning',
        });
      }
    } else {
      await handleCopyRoomLink();
    }
  };

  useEffect(() => {
    if (isOwner) {
      asyncEmitEvent(GameEvents.EMIT_GAME_UPDATE_PRIVATE_SETTING, {
        roomId: id,
        options,
      });
    }
  }, [options, isOwner, id, asyncEmitEvent]);

  useEffect(() => {
    if (isOwner) {
      return;
    }

    const handleSettingUpdate = ({ options: newOptions }: { options: PrivateGameOptions }) => {
      setOptions(newOptions);
    };

    registerEvent(GameEvents.ON_GAME_UPDATE_PRIVATE_SETTING, handleSettingUpdate);

    return () => {
      unregisterEvent(GameEvents.ON_GAME_UPDATE_PRIVATE_SETTING, handleSettingUpdate);
    };
  }, [isOwner, registerEvent, unregisterEvent]);

  const handleStart: FormEventHandler = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { game } = await asyncEmitEvent(
        GameEvents.EMIT_GAME_START_PRIVATE_GAME,
        {
          roomId: id,
          options,
        }
      );
      setGame(game);
    } catch (_e) {
      openSnackbar({
        message: 'Failed to start game. Please try again.',
        color: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '400px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center',
        }}
      >
        <Text
          style={{
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '0.5rem',
          }}
        >
          Room Code
        </Text>
        <div
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: '#ffffff',
            fontFamily: 'monospace',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '1rem',
          }}
        >
          {id}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            aria-label="Copy room link"
            onClick={() => {
              void handleCopyRoomLink();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: copied
                ? 'rgba(164, 216, 178, 0.2)'
                : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: copied ? '#a4d8b2' : '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '0.875rem',
            }}
          >
            {copied ? <FaCheck /> : <FaCopy />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            type="button"
            aria-label="Share room link"
            onClick={() => {
              void handleShareRoom();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: 'rgba(139, 92, 246, 0.2)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '0.875rem',
            }}
          >
            <FaShare />
            Share
          </button>
        </div>
      </div>

      <form
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
        onSubmit={handleStart}
      >
        <Text
          component="h2"
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: '0.5rem',
          }}
        >
          Game Settings
        </Text>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Drawing Time
            </label>
            <select
              name="drawing"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '1.25rem',
                fontWeight: 600,
                cursor: isOwner ? 'pointer' : 'not-allowed',
              }}
              value={options.drawing}
              onChange={handleSettingChange}
              disabled={!isOwner}
            >
              {drawingTimeOptions.map((opt) => (
                <option
                  key={opt}
                  value={opt}
                  style={{
                    background: '#1a1a2e',
                    color: '#ffffff',
                  }}
                >
                  {opt}s
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Rounds
            </label>
            <select
              name="round"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '1.25rem',
                fontWeight: 600,
                cursor: isOwner ? 'pointer' : 'not-allowed',
              }}
              value={options.round}
              onChange={handleSettingChange}
              disabled={!isOwner}
            >
              {roundOptions.map((opt) => (
                <option
                  key={opt}
                  value={opt}
                  style={{
                    background: '#1a1a2e',
                    color: '#ffffff',
                  }}
                >
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg btn-full"
          style={{ marginTop: '0.5rem' }}
          disabled={!isOwner || isLoading}
        >
          {isLoading
            ? 'Starting...'
            : isOwner
            ? 'Start Game'
            : 'Waiting for host...'}
        </button>
      </form>
    </div>
  );
};

export default PrivateLobby;
