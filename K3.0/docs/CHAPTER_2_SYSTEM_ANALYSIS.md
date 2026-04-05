# CHAPTER 2: SYSTEM ANALYSIS

## 2.1 Existing Systems

KRIBBLE has evolved through multiple iterations, with two primary existing systems:

### Kribble 2.0 (Legacy Stable Version)
A monorepo with separate client/server Docker deploys on Render. Key characteristics from comprehensive analysis:

**Server Architecture (Express + Socket.IO):**
- Services: DoodlerService (players), RoomService (rooms), GameService (logic), SocketService (events).
- Models: DoodlerModel, RoomModel (max 8 players, public/private), GameModel (state machine).
- Socket Events: Room (join/create), Doodler (set/get), Game (canvas ops/hunch/choose-word/start).
- Game States: LOBBY → ROUND_START → CHOOSE_WORD → GAME → TURN_END → RESULT.

**Client Architecture (React CRA + Tailwind + Contexts):**
- Routes: Home → Game/:roomId.
- Contexts: User/Socket/Room/Game/Canvas/Snackbar.
- CanvasV2: Strokes (points/color/size), operations (LINE/FILL/ERASE/CLEAR), viewport (zoom/pan), touch gestures, WebWorker flood-fill.
- UI Components: Avatar, Button, Dialog, Snackbar, Tooltip.

**Features:** Real-time sync, scoring (time-based 100-50pts), 1000+ words, multi-round (default 3), tools (pen/erase/fill/clear).

**Tech Stack:** TS, Socket.IO v4, CRACO, Docker.

### K3.0 (Current Production Version)
Modern monorepo refactor extracting logic into reusable packages:

**Structure:**
```
K3.0/
├── apps/server/          # Fastify HTTP/WS + Prisma/Redis
├── apps/web-desktop/     # Vite React TS Tailwind
├── apps/web-mobile/      # Vite React TS (touch-optimized)
└── packages/             # drawing-engine, game-engine, shared-types
```

**Key Improvements:**
- Modular engines: DrawingEngine (CanvasV2 port: strokes/viewport/commands/layers), GameEngine (state machine).
- Persistence: Prisma (User/Room/RoomPlayer/GameHistory/StrokeLog; SQLite dev/Postgres prod).
- Caching: Redis pub/sub.
- Deployment: Docker-compose (vs Render).
- Perf: 60fps desktop/optimized viewport.

**Migration Path:** CanvasV2 → DrawingEngine, services → Prisma, CRA → Vite monorepo.

Both systems share core logic (game flow/scoring), but K3.0 adds modularity/persistence/cross-device support.

## 2.2 Scope and Limitations of Existing Systems

### Scope (What is Included)
- **Core Functionality:** Multiplayer rooms (public/private/code), auth (guest/email), drawing/guessing gameplay, real-time canvas sync, scoring/leaderboards, multi-round games.
- **Platforms:** Web desktop/mobile.
- **Deployment:** Local (docker-compose), cloud (Render/Docker).
- **Scale:** Rooms up to 8 players.

### Limitations (What is Not Included/Constrained)
- **No Persistence in v2.0:** In-memory only (lost on restart); K3.0 adds Prisma but dev SQLite (switch to Postgres prod).
- **No Advanced Auth:** Guest only in v2.0; K3.0 plans JWT/Google (partial).
- **Canvas Limits:** No AI judging/custom brushes/ranked modes (future scope).
- **Scale:** Designed for small rooms (8 max); no horizontal scaling (Redis pubsub planned).
- **Mobile:** v2.0 touch basic; K3.0 optimized but incomplete UI.
- **Offline:** No PWA/service workers.
- **Security:** Basic CORS/heartbeats; needs rate limiting/validation polish (PRODUCTION_PLAN todos).

From PRODUCTION_PLAN.md: Auth/WS/game impl partial; full stable post-todos.

## 2.3 Project Perspective, Features

### Project Perspective
KRIBBLE addresses real-time collaborative drawing challenges:
- **Evolution:** v0 (single-player prototype) → v2.0 (multiplayer MVP) → K3.0 (modular production platform).
- **Vision:** Scalable Pictionary game with cross-device support, deterministic sync, state reconciliation.
- **Advantages:** Low-latency (<100ms WS), performant canvas (10k strokes/60fps), modular (reusable engines).
- **Positioning:** Self-hostable alternative to Skribbl.io/Pictionary online.

### Key Features Matrix (Across Versions)

| Feature | Kribble2.0 | K3.0 | Details |
|---------|------------|------|---------|
| Auth | Guest (name/avatar) | Guest + Email persist | Prisma User model |
| Rooms | Public/private/code/cap8 | +DB persist/ready checks | Services → Prisma |
| Game States | 6 states | Full StateMachine (7 states) | LOBBY→DRAWING→GUESSING→etc. |
| Canvas | CanvasV2 (strokes/zoom/pan/pressure/fill/erase/undo) | DrawingEngine (+layers/opacity) | Command stack/replay |
| Tools | Pen/erase/fill/clear | +Layers/blend | WebWorker flood-fill |
| Sync | Socket.IO broadcast | Fastify WS (heartbeats/reconnect) | Deterministic ops |
| Scoring | Time-based (100-50pts) | +DB history/cumulative | Multi-round |
| Timers | Drawing 120s/choose 15s/etc. | Server-authoritative | Configurable |
| UI/UX | React CRA/Tailwind/contexts | Vite monorepo desktop/mobile/Zustand | Touch gestures |
| Deploy | Docker/Render | Docker-compose/Postgres/Redis | PRODUCTION_PLAN |
| Perf | Throttled sync | 60fps/10k strokes viewport | Optimizations complete |

Full progression tracked in KRIBBLE_FULL_SYSTEM_DOCUMENTATION.md.

## 2.4 Requirement Analysis

### Functional Requirements
- **Authentication:** Guest login (name/avatar), email persistence (User model); JWT tokens.
- **Room Management:** Create/join (code/public), ready checks, player list, drawer rotation.
- **Gameplay:** Word selection (3 options), drawing phase (canvas ops broadcast), guessing (hunch validation: CORRECT/NEARBY/WRONG), scoring, multi-round (default 3).
- **Canvas:** Input (mouse/touch/pressure), tools (line/fill/erase/clear), viewport (zoom/pan/reset), undo/redo (command stack), export.
- **Real-time:** WS connection mgmt, message routing, room broadcasts.

### Performance Requirements
- Latency: WS <100ms round-trip.
- Rendering: 60fps desktop, 30+fps mobile; 10k+ strokes replayable.
- Scale: 100+ concurrent rooms (Redis pubsub); rooms ≤8 players.
- Sync: Deterministic command replay (no bitmap lag).

### Security Requirements
- **Auth:** JWT validation on WS upgrade; guest temp IDs.
- **Validation:** Zod schemas for payloads; server-authoritative state.
- **DoS:** Heartbeats/ping-pong, stale connection removal, rate limiting.
- **Data:** Prisma transactions; no PII beyond email/username.
- **CORS:** Allowed origins (client URLs).

### Other Requirements
- **Reliability:** Reconnects/snapshots on disconnect.
- **Usability:** Mobile gestures, responsive UI, snackbars/errors.
- **Maintainability:** TS strict, monorepo workspaces, docs/TODOs.
- **Deployment:** Docker/self-hostable; env-configurable.

**References:** KRIBBLE_2.0_ANALYSIS.md (v2 details), KRIBBLE_FULL_SYSTEM_DOCUMENTATION.md (K3.0), schema.prisma (DB), PRODUCTION_PLAN.md (todos).

**Status:** K3.0 production-stable with listed scope; future enhancements per docs.

