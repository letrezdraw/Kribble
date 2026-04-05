import { FormEvent, useEffect, useState } from 'react';
import { FaDice, FaHouse, FaUser } from 'react-icons/fa6';
import { Link } from 'react-router-dom';

import Avatar from '@/components/Avatar';
import Text from '@/components/Text';
import { DoodlerEvents } from '@/constants/Events';
import { LocalStorageKeys } from '@/constants/LocalStorage';
import texts from '@/constants/texts';
import { useSnackbar } from '@/contexts/snackbar';
import { SocketConnectionState, useSocket } from '@/contexts/socket';
import { useUser } from '@/contexts/user';
import useScreenSize from '@/hooks/useScreenSize';
import { getRandomAvatarProps } from '@/utils/avatar';
import { ErrorFromServer } from '@/utils/error';

const Profile = () => {
  const isMobile = useScreenSize('mobile');
  const { user, updateUser } = useUser();
  const { asyncEmitEvent, socketConnectionState } = useSocket();
  const { openSnackbar } = useSnackbar();
  const [name, setName] = useState(user.name);

  useEffect(() => {
    setName(user.name);
  }, [user.name]);

  const isBusy = [
    SocketConnectionState.CONNECTING,
    SocketConnectionState.RECONNECTING,
  ].includes(socketConnectionState);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      openSnackbar({ message: texts.home.form.validation.error, color: 'error' });
      return;
    }
    updateUser('name', trimmed);
    localStorage.setItem(LocalStorageKeys.USER_NAME, trimmed);
    localStorage.setItem(
      LocalStorageKeys.USER_AVATAR,
      JSON.stringify(user.avatar)
    );

    if (socketConnectionState === SocketConnectionState.CONNECTED) {
      try {
        await asyncEmitEvent(DoodlerEvents.EMIT_SET_DOODLER, {
          name: trimmed,
          avatar: user.avatar,
        });
      } catch (err) {
        if (err instanceof ErrorFromServer) {
          openSnackbar({ message: err.message, color: 'error' });
          return;
        }
      }
    }
    openSnackbar({ message: texts.profile.saved, color: 'success' });
  };

  const randomizeAvatar = () => {
    const next = getRandomAvatarProps();
    updateUser('avatar', next);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '1rem' : '2rem',
        background:
          'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : '440px',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: isMobile ? '1.5rem' : '2.25rem',
        }}
      >
        <Text
          component="h1"
          style={{
            margin: '0 0 0.5rem',
            fontSize: isMobile ? '1.5rem' : '1.75rem',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.95)',
          }}
        >
          {texts.profile.title}
        </Text>
        <Text
          style={{
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          {texts.profile.subtitle}
        </Text>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ width: 120, height: 120 }}>
            <Avatar avatarProps={user.avatar} />
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            type="button"
            disabled={isBusy}
            onClick={randomizeAvatar}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1rem',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            <FaDice /> {texts.profile.randomAvatar}
          </button>

          <div style={{ position: 'relative' }}>
            <FaUser
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.45)',
              }}
            />
            <input
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              placeholder={texts.profile.namePlaceholder}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.9rem 1rem 0.9rem 2.75rem',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: '1rem',
              }}
            />
          </div>

          <Text style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
            {texts.profile.hint}
          </Text>

          <button
            type="submit"
            disabled={isBusy}
            style={{
              padding: '0.9rem',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              color: '#fff',
              fontWeight: 600,
              cursor: isBusy ? 'not-allowed' : 'pointer',
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            {texts.profile.save}
          </button>
        </form>

        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '1.25rem',
            color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none',
            fontSize: '0.9rem',
          }}
        >
          <FaHouse /> {texts.profile.backHome}
        </Link>
      </div>
    </div>
  );
};

export default Profile;
