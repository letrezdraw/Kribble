// @ts-nocheck
import React from 'react';

import Loading from '../../components/Loading';
import Text from '../../components/Text';
import texts from '../../constants/texts';
import { useRoom } from '../../contexts/room';

import PrivateLobby from './PrivateLobby';

const Lobby = () => {
  const { room } = useRoom();

  return (
    <>
      {room.isPrivate ? (
        <PrivateLobby />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem',
            textAlign: 'center',
          }}
        >
          <Text
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            {texts.game.lobby.waiting}
          </Text>
          <Loading />
          <Text
            style={{
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            Waiting for more players to join...
          </Text>
        </div>
      )}
    </>
  );
};

export default Lobby;
