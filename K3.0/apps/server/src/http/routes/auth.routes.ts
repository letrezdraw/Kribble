import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as authService from '../../services/auth.service.js';

// Zod schemas for validation
const guestLoginSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
});

interface GuestLoginBody {
  displayName?: string;
}

interface RegisterBody {
  email: string;
  username: string;
}

export default async function authRoutes(app: FastifyInstance) {
  // Guest login - no auth required
  app.post<{ Body: GuestLoginBody }>(
    '/guest',
    {
      schema: {
        body: guestLoginSchema,
      },
    },
    async (request: FastifyRequest<{ Body: GuestLoginBody }>, reply: FastifyReply) => {
      try {
        const { displayName } = request.body;
        
        const user = await authService.createGuestUser(displayName || '');
        
        // Generate JWT token
        const token = app.jwt.sign({
          id: user.id,
          isGuest: user.isGuest,
        });

        return reply.send({
          user,
          token,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ message: 'Failed to create guest user' });
      }
    }
  );

  // Register new user
  app.post<{ Body: RegisterBody }>(
    '/register',
    {
      schema: {
        body: registerSchema,
      },
    },
    async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
      try {
        const { email, username } = request.body;
        
        // Check if email already exists
        const existingUser = await authService.findUserByEmail(email);
        if (existingUser) {
          return reply.status(400).send({ message: 'Email already registered' });
        }
        
        const user = await authService.createUser(email, username);
        
        // Generate JWT token
        const token = app.jwt.sign({
          id: user.id,
          isGuest: user.isGuest,
        });

        return reply.status(201).send({
          user,
          token,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ message: 'Failed to register user' });
      }
    }
  );

  // Get current user profile
  app.get(
    '/me',
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user as { id: string };
        const userData = await authService.findUserById(user.id);
        
        if (!userData) {
          return reply.status(404).send({ message: 'User not found' });
        }
        
        return reply.send({ user: userData });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ message: 'Failed to get user' });
      }
    }
  );
}

// Extend FastifyInstance to add authenticate decorator
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
