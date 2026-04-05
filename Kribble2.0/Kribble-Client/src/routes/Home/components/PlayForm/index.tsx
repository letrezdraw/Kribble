import {
  ChangeEvent,
  FormEventHandler,
  HTMLAttributes,
  useEffect,
  useState,
} from 'react';
import { FaPlay, FaPlus, FaUser } from 'react-icons/fa6';
import { useNavigate } from 'react-router-dom';

import { DoodlerEvents, RoomEvents } from '@/constants/Events';
import { LocalStorageKeys } from '@/constants/LocalStorage';
import texts from '@/constants/texts';
import { useSnackbar } from '@/contexts/snackbar';
import { SocketConnectionState, useSocket } from '@/contexts/socket';
import { useUser } from '@/contexts/user';
import { ErrorFromServer } from '@/utils/error';

interface PlayFormProps extends HTMLAttributes<HTMLDivElement> {
  roomId: string | null;
}

const PlayForm = ({ roomId, ...props }: PlayFormProps) => {
  const { user, updateUser } = useUser();
  const { socketConnectionState, asyncEmitEvent } = useSocket();
  const navigate = useNavigate();
  const [userName, setUserName] = useState(user.name);
  const { openSnackbar } = useSnackbar();

  const validate = () => {
    if (!userName.trim()) {
      openSnackbar({
        message: texts.home.form.validation.error,
        color: 'error',
      });
      return false;
    }
    return true;
  };

  const handleSetUser = async () => {
    if (!validate()) return false;
    updateUser('name', userName);
    localStorage.setItem(LocalStorageKeys.USER_NAME, userName);
    localStorage.setItem(
      LocalStorageKeys.USER_AVATAR,
      JSON.stringify(user.avatar)
    );
    const data = await asyncEmitEvent(DoodlerEvents.EMIT_SET_DOODLER, {
      name: userName,
      avatar: user.avatar,
    });
    return !!data;
  };

  // Join a Public Room
  const handleJoinPublicRoom = async () => {
    const data = await asyncEmitEvent(
      RoomEvents.EMIT_ADD_DOODLER_TO_PUBLIC_ROOM,
      undefined
    );
    navigate(`/${data.roomId}`);
  };

  // Join a Private Room
  const handleJoinPrivateRoom = async () => {
    if (!roomId) return;
    try {
      const { room } = await asyncEmitEvent(
        RoomEvents.EMIT_ADD_DOODLER_TO_PRIVATE_ROOM,
        { roomId }
      );
      navigate(`/${room.id}`);
    } catch (e) {
      if (e instanceof ErrorFromServer) {
        openSnackbar({ message: e.message, color: 'error' });
      }
      navigate('/');
    }
  };

  const handlePlay: FormEventHandler = async (e) => {
    try {
      e.preventDefault();
      const isSetUser = await handleSetUser();
      if (!isSetUser) return;
      if (roomId) await handleJoinPrivateRoom();
      else await handleJoinPublicRoom();
    } catch (e) {
      if (e instanceof ErrorFromServer) {
        openSnackbar({ message: e.message, color: 'error' });
      }
    }
  };

  const handleCreatePrivateRoom: FormEventHandler = async (e) => {
    try {
      e.preventDefault();

      const isSetUser = await handleSetUser();
      if (!isSetUser) return;
      const data = await asyncEmitEvent(
        RoomEvents.EMIT_CREATE_PRIVATE_ROOM,
        undefined
      );
      navigate(`/${data.roomId}`);
    } catch (e) {
      if (e instanceof ErrorFromServer) {
        openSnackbar({ message: e.message, color: 'error' });
      }
    }
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUserName(e.target.value);
  };

  useEffect(() => {
    const storedName = localStorage.getItem(LocalStorageKeys.USER_NAME);
    if (storedName) setUserName(storedName);
  }, []);

  const isDisabled = [
    SocketConnectionState.CONNECTING,
    SocketConnectionState.RECONNECTING,
    SocketConnectionState.ERROR,
  ].includes(socketConnectionState);

  return (
    <div {...props}>
      <form
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
        noValidate
      >
        {/* Username Input with Icon */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <FaUser
            style={{
              position: 'absolute',
              left: '1rem',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '1.25rem',
            }}
          />
          <input
            autoFocus
            type="text"
            placeholder={texts.home.form.input.name.placeholder}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1rem 1rem 1rem 3rem',
              outline: 'none',
              color: '#ffffff',
              fontSize: '1rem',
              fontFamily: 'inherit',
              transition: 'all 0.3s ease',
            }}
            value={userName}
            required
            onChange={handleNameChange}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          />
        </div>

        {/* Play Button - Primary */}
        <button
          disabled={isDisabled}
          onClick={handlePlay}
          type="submit"
          style={{
            width: '100%',
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            color: '#ffffff',
            fontSize: '1.125rem',
            fontWeight: 600,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
          }}
          onMouseEnter={(e) => {
            if (!isDisabled) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow =
                '0 6px 25px rgba(139, 92, 246, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow =
              '0 4px 15px rgba(139, 92, 246, 0.4)';
          }}
        >
          <FaPlay />
          {texts.home.form.buttons.playPublicGame}
        </button>

        {/* Create Private Room Button - Secondary */}
        <button
          disabled={isDisabled}
          onClick={handleCreatePrivateRoom}
          type="button"
          style={{
            width: '100%',
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            background: 'transparent',
            color: '#ffffff',
            fontSize: '1rem',
            fontWeight: 500,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            if (!isDisabled) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }}
        >
          <FaPlus />
          {texts.home.form.buttons.createPrivateRoom}
        </button>
      </form>
    </div>
  );
};

export default PlayForm;
