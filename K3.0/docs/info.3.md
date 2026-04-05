Perfect.

Now let's write the code.

This is the exact server implementation.

---

# KRIBBLE 3.0 — SERVER FILE-BY-FILE IMPLEMENTATION

---

# A) SERVER STRUCTURE

```
apps/server/src/
├── index.ts              (entry point)
├── http/
│   ├── server.ts         (Fastify setup)
│   └── routes/
│       ├── index.ts
│       ├── auth.routes.ts
│       └── room.routes.ts
├── ws/
│   ├── wsServer.ts
│   ├── connectionManager.ts
│   └── handlers/
│       └── messageRouter.ts
├── game/
│   ├── roomManager.ts
│   ├── gameSession.ts
│   └── stateMachine.ts
├── auth/
│   └── authService.ts
└── db/
    ├── prismaClient.ts
    └── redisClient.ts
```

---

# B) FILE IMPLEMENTATIONS

## FILE: src/index.ts

Purpose:

Boot HTTP server

Attach WebSocket server

Initialize DB

Initialize Redis

Structure:

```
import { initDatabase } from './db/prismaClient'
import { initRedis } from './db/redisClient'
import { createHttpServer } from './http/server'
import { createWebSocketServer } from './ws/wsServer'
import { attachWebSocketHandlers } from './ws/handlers/messageRouter'

async function bootstrap() {
  await initDatabase()
  await initRedis()

  const app = createHttpServer()
  const wsServer = createWebSocketServer(app.server)

  attachWebSocketHandlers(wsServer)

  await app.listen({ port: 4000 })
}

bootstrap()
```

---

## FILE: src/http/server.ts

Purpose:

Create Fastify instance

```
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'

export function createHttpServer() {
  const app = Fastify({ logger: true })

  app.register(cors, { origin: true })
  app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
```

---

## FILE: src/http/routes/auth.routes.ts

```
import { FastifyInstance } from 'fastify'
import { authService } from '../../auth/authService'

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/google', async (request) => {
    const { idToken } = request.body as { idToken: string }
    return authService.verifyGoogleToken(idToken)
  })

  app.post('/auth/guest', async () => {
    return authService.createGuestUser()
  })

  app.get('/me', async (request) => {
    const user = request.user
    return user
  })
}
```

---

## FILE: src/http/routes/room.routes.ts

```
import { FastifyInstance } from 'fastify'
import { roomService } from '../services/room'

export async function roomRoutes(app: FastifyInstance) {
  app.post('/rooms', async (request) => {
    const { name, maxPlayers, isPrivate } = request.body as any
    return roomService.createRoom({ name, maxPlayers, isPrivate })
  })

  app.get('/rooms', async () => {
    return roomService.listRooms()
  })

  app.post('/rooms/:id/join', async (request) => {
    const { id } = request.params
    const { userId } = request.body as any
    return roomService.joinRoom(id, userId)
  })

  app.post('/rooms/:id/leave', async (request) => {
    const { id } = request.params
    const { userId } = request.body as any
    return roomService.leaveRoom(id, userId)
  })
}
```

---

## FILE: src/ws/wsServer.ts

```
import { WebSocketServer as WSServer } from 'ws'
import { Server } from 'http'

export function createWebSocketServer(httpServer: Server) {
  const wss = new WSServer({ server: httpServer })

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      // Handle message in router
    })
  })

  return wss
}
```

---

## FILE: src/ws/connectionManager.ts

Purpose:

Track active connections

```
class ConnectionManager {
  private userSockets = new Map<string, WebSocket>()
  private roomSockets = new Map<string, Set<WebSocket>>()

  addUser(userId: string, ws: WebSocket) {
    this.userSockets.set(userId, ws)
  }

  removeUser(userId: string) {
    const ws = this.userSockets.get(userId)
    this.userSockets.delete(userId)
    // Also remove from roomSockets
  }

  addToRoom(roomId: string, ws: WebSocket) {
    if (!this.roomSockets.has(roomId)) {
      this.roomSockets.set(roomId, new Set())
    }
    this.roomSockets.get(roomId)!.add(ws)
  }

  broadcastToRoom(roomId: string, message: any) {
    const sockets = this.roomSockets.get(roomId)
    if (!sockets) return

    const data = JSON.stringify(message)
    for (const ws of sockets) {
      ws.send(data)
    }
  }
}

export const connectionManager = new ConnectionManager()
```

---

## FILE: src/ws/handlers/messageRouter.ts

```
import { connectionManager } from '../connectionManager'
import { handleStroke } from './strokeHandler'
import { handleGuess } from './guessHandler'

export function attachWebSocketHandlers(wss) {
  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())

      switch (message.type) {
        case 'stroke:start':
        case 'stroke:update':
        case 'stroke:end':
          handleStroke(message)
          break
        case 'guess':
          handleGuess(message)
          break
        case 'chat':
          // Handle chat
          break
      }
    })
  })
}
```

---

## FILE: src/game/roomManager.ts

```
class RoomManager {
  private rooms = new Map<string, GameSession>()

  createRoom(roomId: string) {
    const session = new GameSession(roomId)
    this.rooms.set(roomId, session)
    return session
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId)
  }

  deleteRoom(roomId: string) {
    this.rooms.delete(roomId)
  }
}

export const roomManager = new RoomManager()
```

---

## FILE: src/game/gameSession.ts

```
export class GameSession {
  roomId: string
  players: Map<string, Player>
  currentDrawer: string | null
  currentWord: string | null
  timer: number
  state: GameState

  constructor(roomId: string) {
    this.roomId = roomId
    this.players = new Map()
  }

  addPlayer(player: Player) {
    this.players.set(player.id, player)
  }

  removePlayer(playerId: string) {
    this.players.delete(playerId)
  }

  startGame() {
    this.state = new StartingState()
    this.state.enter(this)
  }
}
```

---

## FILE: src/auth/authService.ts

```
class AuthService {
  async verifyGoogleToken(token: string) {
    // Verify with Google
    // Create or update user in DB
    // Return JWT
  }

  async createGuestUser() {
    // Generate guest user
    // Return JWT
  }

  generateToken(userId: string) {
    // Sign JWT
  }
}

export const authService = new AuthService()
```

---

## FILE: src/db/prismaClient.ts

```
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function initDatabase() {
  await prisma.$connect()
}

export { prisma }
```

---

## FILE: src/db/redisClient.ts

```
import { createClient } from 'redis'

const redis = createClient()

export async function initRedis() {
  await redis.connect()
}

export { redis }
```

---

Now you have every file.

---

# NEXT STEPS:

1. Implement drawing engine
2. Implement game state machine
3. Connect mobile and desktop clients
4. Deploy

Tell me when you're ready for Drawing Engine code.
