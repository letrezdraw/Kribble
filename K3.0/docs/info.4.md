A) SERVER FILE-BY-FILE IMPLEMENTATION PLAN
================================

Target stack:

Node 20+

TypeScript

Fastify

ws

Prisma

PostgreSQL

Redis

📁 apps/server/src/
FILE: src/index.ts

Purpose:

Boot HTTP server

Attach WebSocket server

Initialize DB

Initialize Redis

Register routes

Structure:

async function bootstrap() {
  await initDatabase()
  await initRedis()

  const app = createHttpServer()
  const wsServer = createWebSocketServer(app.server)

  attachWebSocketHandlers(wsServer)

  await app.listen({ port: 4000 })
}

Exports: none
Entrypoint only.

FILE: src/http/server.ts

Purpose:
Create Fastify instance.

Responsibilities:

CORS

Rate limiting

JWT verification hook

Register route modules

Exports:

export function createHttpServer(): FastifyInstance
FILE: src/http/routes/auth.routes.ts

Endpoints:

POST /auth/google
POST /auth/guest
GET /me

Dependencies:

AuthService

UserService

FILE: src/http/routes/room.routes.ts

Endpoints:

POST /rooms
GET /rooms
POST /rooms/:id/join
POST /rooms/:id/leave

FILE: src/ws/wsServer.ts

Purpose:
Create WebSocket server instance.

export function createWebSocketServer(httpServer)
FILE: src/ws/connectionManager.ts

Purpose:

Track active connections

Map userId → socket

Map roomId → sockets

Internal maps:

Map<userId, WebSocket>
Map<roomId, Set<WebSocket>>
FILE: src/ws/handlers/messageRouter.ts

Purpose:
Central router:

switch(message.type) {
  case "stroke:start"
  case "stroke:update"
  case "guess"
  case "chat"
}

Never implement logic here.
Delegate to services.

FILE: src/game/roomManager.ts

Purpose:

Create room in memory

Track active game sessions

Attach GameEngine instance per room

Internal:

Map<roomId, GameSession>
FILE: src/game/gameSession.ts

Purpose:
Wraps GameStateMachine.

Holds:

players

scores

currentDrawer

word

timer

FILE: src/game/stateMachine.ts

Full game logic (detailed in section D).

FILE: src/auth/authService.ts

Handles:

Google token verification

Guest creation

JWT generation

FILE: src/db/prismaClient.ts

Exports Prisma singleton.

FILE: prisma/schema.prisma

Tables:

User
Room
RoomPlayer
GameHistory
StrokeLog

(Already defined previously — enforce strict types.)

================================
B) EXACT WEBSOCKET PROTOCOL CONTRACT
================================

NaNordinates.

================================
C) DRAWING ENGINE 3.0 SKELETON
================================

Location:
packages/drawing-engine/

📁 drawing-engine/src/
DrawingEngine.ts
export class DrawingEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private viewport: ViewportEngine
  private layers: LayerManager
  private commandStack: CommandStack
  private brushEngine: BrushEngine
  private inputController: InputController
  private renderPipeline: RenderPipeline
}

Responsibilities:

Own RAF loop

Manage active stroke

Replay commands

ViewportEngine.ts

State:

offsetX
offsetY
scale
rotation
minScale
maxScale

Methods:

zoomAt(x,y,delta)
pan(dx,dy)
rotate(delta)
reset()
applyTransform(ctx)
BrushEngine.ts

Handles:

Pressure curve

Smoothing

Stroke interpolation (Catmull-Rom)

StrokeSmoother.ts

Implements:

Catmull-Rom spline

EMA pressure smoothing

CommandStack.ts

Immutable commands:

execute()
undo()
redo()
serialize()
LayerManager.ts

Future-proof:

addLayer()
removeLayer()
setActiveLayer()
renderAll(ctx)
RenderPipeline.ts

Steps:

Reset transform

Clear canvas

Draw background

Apply viewport

Render layers

Render active stroke

================================
D) GAME STATE MACHINE FULL SPEC
================================

Location:
packages/game-engine/

States:

Lobby
Starting
WordSelection
Drawing
Guessing
RoundEnd
GameEnd
Base Interface
interface GameState {
  enter(context)
  update(context)
  exit(context)
}
DrawingState

On enter:

Set drawer

Start timer

On update:

Check timer

Check correct guesses

On exit:

Lock drawing

RoundEndState

Calculate scores

Broadcast scoreboard

Wait 5 seconds

Transition

Server triggers transitions only.

================================
E) DEPLOYMENT ARCHITECTURE
================================
Docker Structure
docker-compose.yml

Services:

web-desktop

web-mobile

server

postgres

redis

Dockerfile (server)
FROM node:20
WORKDIR /app
COPY .
RUN npm install
RUN npm run build
CMD ["node", "dist/index.js"]
CI/CD

Use:

GitHub Actions

Pipeline:

Lint

Typecheck

Test

Build

Docker build

Push to registry

Deploy (VPS or Fly.io)

INFRA (Production)

Recommended:

VPS (Hetzner / DigitalOcean)

Nginx reverse proxy

PM2 or Docker

HTTPS via Let's Encrypt
