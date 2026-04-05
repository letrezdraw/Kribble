Good.

Now we stop thinking like a feature builder.

We think like:

> CTO designing Kribble 3.0 from zero for scale, stability, and long-term evolution.

You want extreme depth.

So this will be:

* System architecture
* Exact folder structure
* Backend schema
* WebSocket protocol
* Drawing engine internal rewrite
* Game state machine full spec
* Mobile vs Desktop routing strategy
* Dev phases
* Stability layer
* Performance strategy
* Deployment structure

This is a real product blueprint.

---

# 🧠 KRIBBLE 3.0 — COMPLETE SYSTEM ARCHITECTURE

---

# 0️⃣ MONOREPO STRUCTURE (PRODUCTION READY)

Use:

* pnpm workspaces
* turborepo (optional)
* TypeScript everywhere

```
kribble-3/
│
├── apps/
│   ├── web-desktop/
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── LoginPage.tsx
│   │   │   │   │   └── RegisterPage.tsx
│   │   │   │   ├── home/
│   │   │   │   │   └── HomePage.tsx
│   │   │   │   ├── room/
│   │   │   │   │   └── RoomPage.tsx
│   │   │   │   └── profile/
│   │   │   │       └── ProfilePage.tsx
│   │   │   ├── components/
│   │   │   ├── layouts/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   ├── routes.tsx
│   │   │   └── main.tsx
│   │   └── package.json
│
│   ├── web-mobile/
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── LoginMobile.tsx
│   │   │   │   ├── HomeMobile.tsx
│   │   │   │   ├── RoomMobile.tsx
│   │   │   │   └── ProfileMobile.tsx
│   │   │   ├── components/
│   │   │   └── main.tsx
│   │   └── package.json
│
│   └── server/
│       ├── src/
│       │   ├── index.ts
│       │   ├── http/
│       │   ├── ws/
│       │   ├── game/
│       │   ├── auth/
│       │   ├── db/
│       │   └── services/
│       └── package.json
│
├── packages/
│   ├── drawing-engine/
│   ├── game-engine/
│   ├── protocol/
│   ├── shared-types/
│   └── utils/
│
└── package.json
```

---

# 1️⃣ BACKEND ARCHITECTURE (NODE + WS)

Use:

* Node.js
* Fastify or Express
* ws (WebSocket)
* PostgreSQL
* Redis (rooms + pubsub)
* Prisma ORM

---

## Server Layers

```
HTTP API Layer
WebSocket Layer
Game Engine Layer
Room Manager
Auth Layer
Database Layer
```

---

## HTTP Endpoints

```
POST /auth/google
POST /auth/guest
GET  /me
POST /rooms
GET  /rooms
POST /rooms/:id/join
```

---

## WebSocket Structure

On connect:

```
{
  type: "auth",
  token: "jwt_token"
}
```

---

# 2️⃣ DATABASE SCHEMA (PRISMA)

```
prisma
model User {
  id        String   @id @default(uuid())
  email     String?  @unique
  guestId   String?  @unique
  username  String
  avatar    String?
  createdAt DateTime @default(now())
  
  rooms     RoomPlayer[]
  stats     UserStats?
}

model Room {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  maxPlayers  Int      @default(8)
  isPrivate   Boolean  @default(false)
  status      RoomStatus @default(LOBBY)
  
  players     RoomPlayer[]
  createdAt   DateTime @default(now())
}

model RoomPlayer {
  id        String   @id @default(uuid())
  userId    String
  roomId    String
  isDrawer  Boolean  @default(false)
  score     Int      @default(0)
  isReady   Boolean  @default(false)
  
  user      User     @relation(fields: [userId], references: [id])
  room      Room     @relation(fields: [roomId], references: [id])
}

model GameHistory {
  id          String   @id @default(uuid())
  roomId      String
  players     Json
  winnerId    String
  scores      Json
  playedAt    DateTime @default(now())
}

model StrokeLog {
  id        String   @id @default(uuid())
  gameId    String
  userId    String
  points    Json
  color     String
  size      Float
  timestamp DateTime @default(now())
}
```

---

# 3️⃣ DRAWING ENGINE 3.0 (CLIENT)

Location:

```
packages/drawing-engine/
```

---

## Structure

```
src/
├── DrawingEngine.ts
├── ViewportEngine.ts
├── BrushEngine.ts
├── CommandStack.ts
├── LayerManager.ts
├── RenderPipeline.ts
└── index.ts
```

---

## Core Classes

### DrawingEngine

Manages canvas, viewport, layers.

### ViewportEngine

Pan, zoom, rotate.

### BrushEngine

Pressure, smoothing, interpolation.

### CommandStack

Immutable undo/redo stack.

---

## Stroke Smoothing

Use Catmull-Rom spline.

Pressure smoothing via EMA:

```
p_smooth = alpha * p_current + (1-alpha) * p_prev
```

---

# 4️⃣ GAME ENGINE 3.0 (SERVER SIDE)

Inside:

```
packages/game-engine/
```

---

## State Machine

```
class GameStateMachine {
  currentState

  transition(newState)
}
```

States:

```
LobbyState
StartingState
WordSelectionState
DrawingState
GuessingState
RoundEndState
GameEndState
```

Each state:

```
enter(context)
update(context)
exit(context)
```

---

## Server Authoritative

Server decides:

* Who is drawer
* What word is
* When timer ends
* Score calculation

Clients only render.

---

# 5️⃣ ADVANCED GAME LOGIC

Score formula:

```
score = base
+ speedBonus
+ difficultyMultiplier
- hintPenalty
```

Prevent cheating:

* Drawer cannot send guesses
* Guess text filtered server side
* Word never sent to non-drawer

---

# 6️⃣ MOBILE VS DESKTOP ROUTING

Instead of responsive:

Use:

```
if (navigator.userAgent.includes("Mobile"))
  redirect to /m/*
```

Two separate builds:

* web-desktop
* web-mobile

Shared engine underneath.

---

# 7️⃣ STABILITY LAYER

Add:

### Heartbeat

Every 10s:

```
ping
pong
```

If no pong:
Disconnect user.

---

### Reconnection

Client sends:

```
{
  type: "reconnect",
  roomId
}
```

Server reattaches.

---

# 8️⃣ PERFORMANCE STRATEGY

Desktop:

* 60fps target
* DPR scaling
* 100k points safe

Mobile:

* 30fps fallback
* Reduced smoothing
* Smaller canvas resolution

---

# 9️⃣ DEV ROADMAP

Phase 1:
Auth + DB + basic rooms

Phase 2:
WebSocket + simple game loop

Phase 3:
Drawing engine rewrite

Phase 4:
Mobile UI

Phase 5:
Stability & reconnection

Phase 6:
Optimization

---

# 🔟 FUTURE-PROOFING

Prepare for:

* Ranked matchmaking
* Spectator mode
* Replay viewer
* AI moderation
* Custom brush marketplace

---

# 🧠 WHAT KRIBBLE 3.0 REALLY IS

It's not a game.

It's:

> A modular real-time drawing platform with deterministic multiplayer state replication.

---

If you want next level:

I can now write:

* Exact server file-by-file implementation plan
* Exact WebSocket message contracts
* DrawingEngine 3.0 code skeleton (thousands of lines structured)
* Complete game state machine pseudo-code
* Production deployment architecture (Docker + CI/CD)

Tell me which section we go deeper into next.

We build this like a real company.
