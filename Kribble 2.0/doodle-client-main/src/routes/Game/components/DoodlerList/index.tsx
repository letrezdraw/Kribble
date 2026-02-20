import { Fragment, HTMLAttributes, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { RoomEvents } from '@/constants/Events';
import { useRoom } from '@/contexts/room';
import { useSocket } from '@/contexts/socket';

import Doodler from './Doodler';

const DoodlerList = (props: HTMLAttributes<HTMLDivElement>) => {
  const { room, setRoom } = useRoom();
  const { asyncEmitEvent } = useSocket();
  const { roomId } = useParams();

  // Fetch room data when component mounts
  useEffect(() => {
    const fetchRoom = async () => {
      if (roomId && (!room.id || room.id !== roomId)) {
        try {
          const data = await asyncEmitEvent(RoomEvents.EMIT_GET_ROOM, roomId);
          if (data && data.room) {
            setRoom(data.room);
          }
        } catch (e) {
          // Silently handle error
        }
      }
    };
    fetchRoom();
  }, [roomId, room.id, setRoom, asyncEmitEvent]);

  return (
    <div {...props} style={{ height: '100%', ...props.style }}>
      <div
        style={{
          padding: '0.75rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
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
          <span>Players</span>
          <span
            style={{
              background: 'rgba(139, 92, 246, 0.3)',
              color: '#fff',
              padding: '0.125rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
            }}
          >
            {room.doodlers.length}
          </span>
        </h2>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            overflow: 'auto',
            flex: 1,
            paddingTop: '0.25rem',
          }}
        >
          {room.doodlers.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '0.875rem',
                padding: '1rem',
              }}
            >
              No players yet...
            </div>
          ) : (
            room.doodlers.map((doodler, index) => (
              <Fragment key={`doodler-${doodler.id}`}>
                <Doodler
                  key={`doodler-item-${doodler.id}`}
                  doodler={doodler}
                  position={index}
                  isDrawing={room.drawerId === doodler.id}
                />
                {index !== room.doodlers.length - 1 && (
                  <div
                    key={`divider-${doodler.id}`}
                    style={{
                      height: '1px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      margin: '0.25rem 0',
                    }}
                  />
                )}
              </Fragment>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DoodlerList;
