import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as roomService from '../../services/room.service.js';

// Zod schemas for validation
const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  maxPlayers: z.number().min(2).max(12).optional(),
  isPrivate: z.boolean().optional(),
});

const joinRoomSchema = z.object({
  code: z.string().length(4),
});

const setReadySchema = z.object({
  isReady: z.boolean(),
});

interface CreateRoomBody {
  name: string;
  maxPlayers?: number;
  isPrivate?: boolean;
}

interface JoinRoomParams {
  code: string;
}

interface SetReadyBody {
  isReady: boolean;
}

export default async function roomRoutes(app: FastifyInstance) {
  // Get all public rooms
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rooms = await roomService.getAllRooms();
      return reply.send({ rooms });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Failed to get rooms' });
    }
  });

  // Create a new room
  app.post<{ Body: CreateRoomBody }>(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        body: createRoomSchema,
      },
    },
    async (request: FastifyRequest<{ Body: CreateRoomBody }>, reply: FastifyReply) => {
      try {
        const user = request.user as { id: string };
        const { name, maxPlayers, isPrivate } = request.body;
        
        const room = await roomService.createRoom(
          name,
          user.id,
          maxPlayers || 8,
          isPrivate || false
        );
        
        return reply.status(201).send({ room });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ message: 'Failed to create room' });
      }
    }
  );

  // Get room by code
  app.get<{ Params: JoinRoomParams }>(
    '/:code',
    async (request: FastifyRequest<{ Params: JoinRoomParams }>, reply: FastifyReply) => {
      try {
        const { code } = request.params;
        const room = await roomService.getRoomByCode(code.toUpperCase());
        
        if (!room) {
          return reply.status(404).send({ message: 'Room not found' });
        }
        
        return reply.send({ room });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ message: 'Failed to get room' });
      }
    }
  );

  // Join a room
  app.post<{ Params: JoinRoomParams }>(
    '/:code/join',
    {
      preHandler: [app.authenticate],
      schema: {
        params: joinRoomSchema,
      },
    },
    async (request: FastifyRequest<{ Params: JoinRoomParams }>, reply: FastifyReply) => {
      try {
        const { code } = request.params;
        const user = request.user as { id: string };
        
        const room = await roomService.getRoomByCode(code.toUpperCase());
        if (!room) {
          return reply.status(404).send({ message: 'Room not found' });
        }
        
        const updatedRoom = await roomService.joinRoom(room.id, user.id);
        
        return reply.send({ room: updatedRoom });
      } catch (error: any) {
        if (error.message === 'Room is full') {
          return reply.status(400).send({ message: 'Room is full' });
        }
        request.log.error(error);
        return reply.status(500).send({ message: 'Failed to join room' });
      }
    }
  );

  // Leave a room
  app.post<{ Params: JoinRoomParams }>(
    '/:code/leave',
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest<{ Params: JoinRoomParams }>, reply: FastifyReply) => {
      try {
        const { code } = request.params;
        const user = request.user as { id: string };
        
        const room = await roomService.getRoomByCode(code.toUpperCase());
        if (!room) {
          return reply.status(404).send({ message: 'Room not found' });
        }
        
        await roomService.leaveRoom(room.id, user.id);
        
        return reply.send({ message: 'Left room successfully' });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ message: 'Failed to leave room' });
      }
    }
  );

  // Set player ready status
  app.post<{ Params: JoinRoomParams; Body: SetReadyBody }>(
    '/:code/ready',
    {
      preHandler: [app.authenticate],
      schema: {
        params: joinRoomSchema,
        body: setReadySchema,
      },
    },
    async (request: FastifyRequest<{ Params: JoinRoomParams; Body: SetReadyBody }>, reply: FastifyReply) => {
      try {
        const { code } = request.params;
        const user = request.user as { id: string };
        const { isReady } = request.body;
        
        const room = await roomService.getRoomByCode(code.toUpperCase());
        if (!room) {
          return reply.status(404).send({ message: 'Room not found' });
        }
        
        const updatedRoom = await roomService.setPlayerReady(room.id, user.id, isReady);
        
        return reply.send({ room: updatedRoom });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ message: 'Failed to set ready status' });
      }
    }
  );
}
