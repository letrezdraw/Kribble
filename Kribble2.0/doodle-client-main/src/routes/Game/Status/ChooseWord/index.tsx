import React from 'react';

import Button from '@/components/Button';
import Loading from '@/components/Loading';
import Text from '@/components/Text';
import { GameEvents } from '@/constants/Events';
import texts from '@/constants/texts';
import { useRoom } from '@/contexts/room';
import { useSocket } from '@/contexts/socket';
import { useUser } from '@/contexts/user';

interface ChooseWordInterface {
  wordOptions?: Array<string>;
}

const ChooseWord = ({ wordOptions }: ChooseWordInterface) => {
  const { room } = useRoom();
  const { user } = useUser();
  const { asyncEmitEvent } = useSocket();
  const isDrawing = user.id === room.drawerId;
  const drawer = room.doodlers.find(({ id }) => id === room.drawerId);

  const handleWordChoice = async (word: string) => {
    await asyncEmitEvent(GameEvents.EMIT_GAME_CHOOSE_WORD, {
      roomId: room.id,
      word,
    });
  };

  if (!isDrawing) {
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
            {drawer?.name + texts.game.chooseWord.title.hunchers}
          </Text>
          <Loading />
          <Text
            style={{
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            Waiting for word selection...
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'rgba(26, 26, 46, 0.8)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '2rem',
      }}
    >
      <Text
        style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          color: '#ffffff',
          textAlign: 'center',
        }}
      >
        {texts.game.chooseWord.title.drawer}
      </Text>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '1rem',
        }}
      >
        {wordOptions ? (
          wordOptions.map((word, index) => (
            <Button
              key={index}
              variant="secondary"
              style={{
                whiteSpace: 'nowrap',
                padding: '1rem 2rem',
                fontSize: '1.125rem',
                fontWeight: 600,
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
              }}
              onClick={() => handleWordChoice(word)}
            >
              {word}
            </Button>
          ))
        ) : (
          <Loading />
        )}
      </div>
    </div>
  );
};

export default ChooseWord;
