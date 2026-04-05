import { FaPencil } from 'react-icons/fa6';

import Avatar from '@/components/Avatar';
import Text from '@/components/Text';
import texts from '@/constants/texts';
import { useUser } from '@/contexts/user';
import { DoodlerInterface } from '@/types/models/doodler';

interface DoodlerProps {
  doodler: DoodlerInterface;
  position: number;
  isDrawing: boolean;
}

const Doodler = ({ doodler, isDrawing }: DoodlerProps) => {
  const { user } = useUser();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <Avatar style={{ minWidth: '80px' }} avatarProps={doodler.avatar} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <p
            style={{
              color: 'var(--light-chalk-white)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {doodler.name}
          </p>
          {user.id === doodler.id && (
            <Text
              component={'span'}
              style={{ color: 'var(--light-chalk-blue)' }}
            >
              {texts.game.doodlers.userMarker}
            </Text>
          )}
          <Text
            component={'span'}
            color="secondary"
            style={{ opacity: isDrawing ? 1 : 0, marginLeft: '0.5rem' }}
          >
            <FaPencil
              style={{
                animation: isDrawing
                  ? 'bounce 1s ease-in-out infinite'
                  : 'none',
              }}
            />
          </Text>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          <Text style={{ fontSize: 'var(--text-xs)' }}>Points -</Text>
          <Text
            component="p"
            style={{ color: 'var(--chalk-yellow)', fontSize: 'var(--text-sm)' }}
          >
            {doodler.score}
          </Text>
        </div>
      </div>
    </div>
  );
};
export default Doodler;
