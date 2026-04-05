import { FaLock, FaUserPen } from 'react-icons/fa6';
import { Link } from 'react-router-dom';

import Loading from '@/components/Loading';
import Text from '@/components/Text';
import texts from '@/constants/texts';
import { SocketConnectionState, useSocket } from '@/contexts/socket';
import useScreenSize from '@/hooks/useScreenSize';

import Bubble from '../Game/components/Bubble';
import PlayForm from './components/PlayForm';

const Home = () => {
  const isMobile = useScreenSize('mobile');
  const { socketConnectionState } = useSocket();
  const searchParams = new URLSearchParams(document.location.search);
  const roomIdFromLink = searchParams.get('roomId');

  const isLoading = [
    SocketConnectionState.CONNECTING,
    SocketConnectionState.RECONNECTING,
  ].includes(socketConnectionState);
  const isError = socketConnectionState === SocketConnectionState.ERROR;

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
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background elements */}
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
          top: '-200px',
          left: '-200px',
          animation: 'float 8s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, transparent 70%)',
          bottom: '-100px',
          right: '-100px',
          animation: 'float 10s ease-in-out infinite reverse',
        }}
      />

      {/* Glass card container */}
      <div
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : '480px',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: isMobile ? '2rem 1.5rem' : '3rem',
          boxShadow:
            '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 100px rgba(139, 92, 246, 0.1)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Kribble Logo/Title */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '2.5rem',
            position: 'relative',
          }}
        >
          <Link
            to="/lobby"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.65)',
              textDecoration: 'none',
              padding: '0.35rem 0.65rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            Lobby
          </Link>
          <Link
            to="/profile"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.65)',
              textDecoration: 'none',
              padding: '0.35rem 0.65rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <FaUserPen size={14} />
            Profile
          </Link>
          <h1
            style={{
              fontSize: isMobile ? '2.5rem' : '3.5rem',
              fontWeight: 800,
              background:
                'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 50%, #ec4899 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              margin: 0,
              letterSpacing: '-0.02em',
              textShadow: '0 0 60px rgba(139, 92, 246, 0.3)',
            }}
          >
            Kribble
          </h1>
          <p
            style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: isMobile ? '0.875rem' : '1rem',
              marginTop: '0.5rem',
              fontWeight: 400,
            }}
          >
            Draw, Guess, Have Fun!
          </p>
        </div>

        {isLoading || isError ? (
          isLoading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '2rem',
              }}
            >
              <Loading />
            </div>
          ) : (
            <Text
              color="error"
              style={{ textAlign: 'center', fontSize: 'var(--text-sm)' }}
            >
              {texts.home.form.validation.connect_error}
            </Text>
          )
        ) : (
          <>
            <PlayForm roomId={roomIdFromLink} style={{ width: '100%' }} />
            {roomIdFromLink && roomIdFromLink.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <Bubble>
                  <FaLock style={{ color: '#f59e0b' }} />
                  <Text
                    style={{ textAlign: 'center', fontSize: 'var(--text-sm)' }}
                    color="primary"
                  >
                    {texts.home.privateRoomBubble}
                    <Text component="span" color="warning">
                      {roomIdFromLink}
                    </Text>
                  </Text>
                </Bubble>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: '1.5rem',
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '0.75rem',
          textAlign: 'center',
        }}
      >
        <p>© 2024 Kribble. Made with ❤️ for gamers.</p>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
      `}</style>
    </div>
  );
};

export default Home;
