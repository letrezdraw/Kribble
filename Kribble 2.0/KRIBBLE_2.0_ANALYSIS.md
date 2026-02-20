# Kribble 2.0 - Comprehensive Analysis Document

> This document provides a detailed analysis of the Kribble 2.0 codebase (also known as doodle-client-main/doodle-server-main).

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Server Architecture](#server-architecture)
5. [Client Architecture](#client-architecture)
6. [Game Logic](#game-logic)
7. [Socket Events](#socket-events)
8. [Data Models](#data-models)
9. [Game Flow](#game-flow)
10. [Canvas System](#canvas-system)
11. [Word Bank](#word-bank)
12. [Key Features](#key-features)
13. [Comparison with Kribble 1.0](#comparison-with-kribble-10)
14. [Files of Interest](#files-of-interest)

---

## Overview

Kribble 2.0 is a Pictionary-style multiplayer drawing and guessing game. It features real-time drawing synchronization, public/private rooms, word hint systems, scoring, and multi-round game support. The codebase is well-organized with a clear separation between client and server, using TypeScript throughout.

---

## Tech Stack

### Server (doodle-server-main)

| Technology | Version | Purpose |
|------------|---------|---------|
| Express.js | ^4.18.2 | HTTP server framework |
| Socket.io | ^4.7.2 | Real-time WebSocket communication |
| TypeScript | ^5.1.6 | Type-safe JavaScript |
| nanoid | ^3.3.6 | Unique ID generation |
| cors | ^2.8.5 | Cross-origin resource sharing |
| dotenv | ^16.3.1 | Environment variable management |
| module-alias | ^2.2.3 | Path aliasing |

**Scripts:**
- `npm run dev` - Development with nodemon
- `npm run build` - TypeScript compilation
- `npm run start` - Production build and start

### Client (doodle-client-main)

| Technology | Version | Purpose |
|------------|---------|---------|
| React | ^18.2.0 | UI framework |
| React Router | ^6.15.0 | Client-side routing |
| Socket.io-client | ^4.8.1 | Real-time client |
| Tailwind CSS | ^3.3.3 | Utility-first CSS |
| Craco | ^7.1.0 | React build configuration |
| react-feather | ^2.0.10 | Icon library |
| react-icons | ^4.10.1 | Additional icons |
| @bigheads/core | ^0.3.3 | Avatar generation |

**Scripts:**
- `npm start` - Development server
- `npm run build:container` - Docker build
- `npm run build:production` - Production build

---

## Project Structure

### Server Structure

```
doodle-server-main/
├── src/
│   ├── app.ts                    # Main server entry point
│   ├── constants/
│   │   ├── events/
│   │   │   └── socket.ts         # Socket event definitions
│   │   ├── game.ts               # Game configuration
│   │   └── words.json            # Word bank (1000+ words)
│   ├── controllers/
│   │   └── internal/             # Internal controllers
│   ├── models/
│   │   ├── DoodlerModel.ts       # Player data model
│   │   ├── GameModel.ts          # Game state model
│   │   └── RoomModel.ts          # Room data model
│   ├── services/
│   │   ├── doodler/
│   │   │   ├── DoodlerService.ts # Player management
│   │   │   └── interface.ts
│   │   ├── game/
│   │   │   ├── GameService.ts    # Core game logic
│   │   │   └── interface.ts
│   │   ├── room/
│   │   │   ├── RoomService.ts    # Room management
│   │   │   └── interface.ts
│   │   └── socket/
│   │       ├── SocketService.ts  # Socket handling
│   │       └── interface.ts
│   ├── types/
│   │   ├── game.ts               # Game type definitions
│   │   ├── service.ts            # Service types
│   │   └── socket/
│   │       ├── index.ts          # Socket type exports
│   │       ├── doodler.ts        # Doodler socket events
│   │       ├── game.ts           # Game socket events
│   │       ├── helper.ts         # Type helpers
│   │       └── room.ts           # Room socket events
│   └── utils/
│       ├── error.ts              # Error handling
│       ├── game.ts               # Game utilities
│       ├── service.ts            # Service utilities
│       ├── stack.ts              # Stack data structure
│       ├── unique.ts             # ID generation
│       └── words.ts              # Word utilities
├── Dockerfile
├── package.json
└── tsconfig.json
```

### Client Structure

```
doodle-client-main/
├── src/
│   ├── App.tsx                   # Main app component
│   ├── index.tsx                 # React entry point
│   ├── assets/
│   │   └── brand.svg             # Brand logo
│   ├── components/
│   │   ├── Avatar/               # Avatar component
│   │   ├── Backdrop/             # Backdrop overlay
│   │   ├── Button/              # Button with variants
│   │   │   ├── IconButton/      # Icon button
│   │   │   ├── types.ts
│   │   │   └── utils.ts
│   │   ├── Dialog/              # Modal dialog
│   │   ├── Error/
│   │   │   └── ErrorBoundary/   # Error boundary
│   │   ├── Loading/             # Loading spinner
│   │   ├── Snackbar/            # Notification toasts
│   │   ├── Text/                # Typography
│   │   └── Tooltip/             # Tooltip component
│   ├── constants/
│   │   ├── common.ts             # Common constants
│   │   ├── Events.ts             # Event name constants
│   │   ├── LocalStorage.ts      # Local storage keys
│   │   └── texts/               # Localization
│   │       └── locales/         # Language files
│   ├── contexts/
│   │   ├── canvas/              # Canvas state
│   │   ├── game/                # Game state
│   │   ├── room/                # Room state
│   │   ├── snackbar/            # Notification state
│   │   ├── socket/              # Socket connection
│   │   └── user/                # User/doodler state
│   ├── hooks/
│   │   ├── useDebouncedCallback/
│   │   ├── useLogger/
│   │   ├── usePointerTracker/
│   │   └── useScreenSize/
│   ├── routes/
│   │   ├── Game/                # Game page
│   │   │   ├── index.tsx        # Game layout
│   │   │   ├── Main/            # Canvas area
│   │   │   └── Status/          # Game status components
│   │   │       ├── ChooseWord.tsx
│   │   │       ├── Lobby.tsx
│   │   │       ├── Result.tsx
│   │   │       ├── RoundStart.tsx
│   │   │       └── TurnEnd.tsx
│   │   └── Home/                # Home/landing page
│   ├── types/
│   │   ├── canvas.ts
│   │   ├── common.ts
│   │   ├── models/               # Type definitions for models
│   │   │   ├── doodler.ts
│   │   │   ├── game.ts
│   │   │   ├── hunch.ts
│   │   │   └── room.ts
│   │   └── socket/              # Socket event types
│   ├── utils/
│   │   ├── avatar.ts            # Avatar generation
│   │   ├── colors.ts
│   │   ├── coordinate.ts
│   │   ├── error.ts
│   │   ├── game.ts
│   │   ├── variants.ts
│   │   └── classes/
│   │       ├── stack.ts
│   │       └── drawing/         # Drawing utilities
│   └── workers/
│       └── canvas/
│           └── fill.worker.ts   # Web worker for flood fill
├── public/
│   ├── assets/
│   │   └── background.png
│   └── fonts/
│       └── chalk/               # Chalk-style fonts
├── tailwind.config.js
├── craco.config.js
├── Dockerfile
└── package.json
```

---

## Server Architecture

### Main Entry Point (app.ts)

The server uses Express.js with Socket.io for real-time communication:

```
typescript
// Key aspects:
- Express app for HTTP
- Socket.io server with typed events
- CORS configuration for allowed origins
- Environment-based configuration
- Port: process.env.PORT || 5000
```

### Service Pattern

Kribble 2.0 uses a **service-oriented architecture**:

1. **DoodlerService** - Manages players (create, find, update score)
2. **RoomService** - Manages rooms (create, join, leave, drawer rotation)
3. **GameService** - Core game logic (game states, scoring, timers)
4. **SocketService** - Handles socket event routing

Each service is a singleton with a clear interface:

```
typescript
// Example: GameService methods
- createGame(roomId, options?) => Game
- findGame(gameId) => Game
- deleteGame(gameId) => boolean
- updateStatus(gameId, status, informClients?, options?) => Game
- updateCanvasOperations(gameId, canvasOperation) => Game
- setDefaultOptions(gameId, options) => Game
- getHunchStatus(gameId, message) => HunchStatus
- addHunchTime(gameId, doodlerId) => void
```

---

## Client Architecture

### Routing

The client uses React Router with two main routes:

```
typescript
const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: ':roomId', element: <Game /> }
]);
```

### Context Providers

Nested provider structure for state management:

```
typescript
<ErrorBoundary>
  <SnackbarProvider>
    <UserProvider>
      <SocketProvider>
        <RouterProvider router={router} />
      </SocketProvider>
    </UserProvider>
  </SnackbarProvider>
</ErrorBoundary>
```

### Contexts

| Context | Purpose |
|---------|---------|
| **UserContext** | Current player (id, name, avatar, score) |
| **SocketContext** | Socket connection, event emission/registration |
| **RoomContext** | Current room (id, doodlers, isPrivate, ownerId, drawerId) |
| **GameContext** | Game state (id, status, options, canvasOperations) |
| **CanvasContext** | Canvas reference and drawing utilities |
| **SnackbarContext** | Notification system |

---

## Game Logic

### Game States (GameStatus)

The game follows a state machine with these states:

| State | Description |
|-------|-------------|
| `LOBBY` | Waiting for players to join |
| `CHOOSE_WORD` | Drawer selecting a word from options |
| `GAME` | Active drawing/guessing in progress |
| `TURN_END` | Turn ended, displaying scores |
| `ROUND_START` | New round about to begin |
| `RESULT` | Game over, final results displayed |

### Game State Transitions

```
LOBBY → ROUND_START → CHOOSE_WORD → GAME → TURN_END → (next round)
                                                              ↓
                                                         ROUND_START
                                                              ↓
                                                            RESULT
                                                              ↓
                              (if valid room) → ROUND_START → ...
                              (if invalid) → LOBBY
```

### Default Game Settings

```
typescript
const DEFAULT_GAME_OPTIONS = {
  round: { current: 1, max: 3 },
  timers: {
    drawing: { current: 0, max: 120 },        // 2 minutes
    turnEndCooldownTime: { current: 0, max: 8 },
    roundStartCooldownTime: { current: 0, max: 8 },
    chooseWordTime: { current: 0, max: 15 },   // 15 seconds
    resultCooldownTime: { current: 0, max: 15 }
  },
  word: '_'  // Placeholder until word is chosen
};
```

### Scoring System

The scoring is based on how quickly players guess correctly:

```
typescript
// Algorithm:
- All hunches sorted by timestamp
- First guesser gets highest score (100)
- Last guesser gets lowest score (50)
- Formula: ((1 - relativeTimeDifference) / 2 + 0.5) * maxScore

// maxScore = 100 points per turn
// Points are cumulative across rounds
```

### Hunch System (Guessing)

```
typescript
enum HunchStatus {
  CORRECT = 'correct',   // Exact match
  NEARBY = 'nearby',     // Within 2 character differences
  WRONG = 'wrong'        // More than 2 differences
}

// The server validates guesses and returns status
// When all (n-1) players guess, turn ends
```

---

## Socket Events

### Event Naming Convention

- **Client → Server**: Prepend `ON_` or `EMIT_`
- **Server → Client**: Prepend `EMIT_`

### Room Events

| Event | Direction | Payload | Response |
|-------|-----------|---------|----------|
| `add-doodler-to-public-room` | C→S | undefined | `{ roomId }` |
| `add-doodler-to-private-room` | C→S | `{ roomId }` | `{ room }` |
| `create-private-room` | C→S | undefined | `{ roomId }` |
| `get-room` | C→S | `string` | `{ room, doodlers }` |
| `doodler-join` | S→C | `{ doodler }` | - |
| `doodler-leave` | S→C | `{ doodlerId }` | - |

### Doodler Events (Player Management)

| Event | Direction | Payload | Response |
|-------|-----------|---------|----------|
| `get-doodler` | C→S | undefined | `DoodlerInterface` |
| `set-doodler` | C→S | `{ name, avatar }` | `{ id }` |

### Game Events

| Event | Direction | Payload | Response |
|-------|-----------|---------|----------|
| `get-game` | C→S | `string` | `{ game }` |
| `game-canvas-operation` | C→S | `{ roomId, canvasOperation }` | `{ game }` |
| `game-choose-word` | C→S | `{ roomId, word }` | `{ game }` |
| `game-hunch` | C→S | `{ roomId, message }` | `{ hunch }` |
| `game-start-private-game` | C→S | `{ roomId, options }` | `{ game }` |
| `game-update-private-setting` | C→S | `{ roomId, options }` | `{ game }` |
| `game-status-updated` | S→C | `{ room, game, statusChangeData }` | - |
| `game-canvas-operation` | S→C | `{ canvasOperation }` | - |
| `game-hunch` | S→C | `{ hunch }` | - |
| `game-update-private-setting` | S→C | `{ options }` | - |

---

## Data Models

### DoodlerModel (Player)

```
typescript
class DoodlerModel {
  id: string;           // Unique identifier
  name: string;         // Player name
  avatar: object;       // @bigheads avatar config
  private _score: number;  // Cumulative score
  
  // Methods
  incrementScore(value: number): void
  clearScore(): void
  get json() { return { id, name, avatar, score } }
}
```

### RoomModel

```
typescript
class RoomModel {
  id: string;                  // Unique room ID
  doodlers: string[];          // Array of doodler IDs
  isPrivate: boolean;          // Public or private room
  capacity: number;            // Max players (default: 8)
  private _ownerId?: string;   // Room owner ID
  private _gameId?: string;   // Associated game ID
  private _drawerId?: string; // Current drawer ID
  
  // Methods
  addDoodler(doodlerId: string): boolean
  removeDoodler(doodlerId: string): boolean
  setDrawerId(drawerId: string): void
  get nextDrawerId: string    // Next drawer in rotation
  get isEmpty(): boolean
  isOwner(doodlerId: string): boolean
}
```

### GameModel

```
typescript
class GameModel {
  id: string;                            // Game ID
  private _status: GameStatus;          // Current game state
  private _options: GameOptions;        // Game settings
  private _canvasOperationsStack: Stack<CanvasOperation>;
  private _timer: NodeJS.Timer | null;
  private _roomId: string;
  private _previousDrawerSet: Set<string>;
  private _hunchTimes: Array<[string, number]>;
  
  // Methods
  setStatus(status: GameStatus): void
  addCanvasOperation(op: CanvasOperation): void
  addHunchTime(doodlerId: string, timestamp: number): void
  calculateScoresByHunchTime(): Record<string, number>
  incrementRound(): void
  reset(): void
  startTimer(timeInSeconds: number, callback: () => void): void
}
```

---

## Game Flow

### 1. Player Joins

```
User opens app
    ↓
Socket connects
    ↓
User sets name & avatar (or uses defaults)
    ↓
User can join public room OR create private room
    ↓
Redirected to /:roomId
```

### 2. Lobby Phase

```
Players in room (min 2 required to start)
    ↓
Room owner clicks "Start Game"
    ↓
Game creates and transitions to ROUND_START
```

### 3. Round Start → Choose Word

```
ROUND_START (8 second countdown)
    ↓
CHOOSE_WORD - Drawer selects from 3 word options
    ↓
(If no selection, random word chosen after 15 seconds)
```

### 4. Drawing Phase

```
GAME state - Active drawing
    ↓
Drawer draws on canvas
    ↓
Canvas operations broadcast to all players
    ↓
Other players submit guesses (hunches)
    ↓
When all (n-1) guess correctly → TURN_END
    ↓
Or timer runs out (120 seconds) → TURN_END
```

### 5. Turn End → Next Turn/Round

```
TURN_END - Scores calculated and displayed
    ↓
8 second countdown
    ↓
Next drawer selected
    ↓
If all players have drawn → Check if new round needed
    ↓
Otherwise → CHOOSE_WORD for next drawer
```

### 6. Game End

```
After max rounds (default: 3)
    ↓
RESULT state - Final scores displayed
    ↓
15 second countdown
    ↓
Return to LOBBY or auto-restart
```

---

## Canvas System

### Canvas Operations

The canvas supports four main operations:

```
typescript
enum CanvasAction {
  LINE = 'line',    // Freehand drawing
  FILL = 'fill',   // Flood fill
  ERASE = 'erase', // Eraser tool
  CLEAR = 'clear' // Clear entire canvas
}

interface CanvasOperation {
  actionType: CanvasAction;
  points: Array<Coordinate>;  // Array of {x, y} points
  color?: string;             // Stroke color
  size?: number;             // Stroke/brush size
}
```

### Canvas Flow

```
User draws on canvas
    ↓
Canvas operations collected
    ↓
Sent to server (throttled)
    ↓
Server broadcasts to all room players
    ↓
Clients render operations
```

### Client Canvas Handling

```
typescript
// CanvasContext provides:
- ref: MutableRefObject<HTMLCanvasElement>
- drawing: Drawing class instance

// Drawing class handles:
// - Mouse/touch input
// - Point collection
// - Rendering strokes
// - Flood fill algorithm (via Web Worker)
```

---

## Word Bank

The word bank contains **1000+ words** organized by length:

| Word Length | Examples |
|-------------|----------|
| 3 letters | cat, dog, sun, cup |
| 4 letters | bird, fish, tree, star |
| 5 letters | apple, house, horse, pizza |
| 6 letters | banana, dragon, guitar, kitten |
| 7 letters | airplane, birthday, elephant, rainbow |
| 8 letters | butterfly, computer, dinosaur, mushroom |
| 9+ letters | ambulance, chocolate, Halloween, skateboard |

### Word Categories

The word bank includes:
- Common objects (house, car, tree)
- Animals (cat, elephant, giraffe)
- Food (pizza, burger, sushi)
- Characters (Mickey, Mario, Batman)
- Places (beach, mountain, hospital)
- Actions (running, sleeping, dancing)
- Brands (Google, Apple, McDonalds)
- And much more...

---

## Key Features

### 1. Public Rooms
- Automatic room assignment
- Auto-create new room if all full
- Max 8 players per room

### 2. Private Rooms
- Create with custom room ID
- Shareable invite links
- Owner controls game start

### 3. Private Game Settings
- Customizable rounds (1-10)
- Customizable drawing time (30-300 seconds)
- Settings persist across games

### 4. Drawing Tools
- Freehand brush (variable size/color)
- Eraser tool
- Flood fill
- Clear canvas

### 5. Guessing System
- Real-time guess display
- CORRECT/NEARBY/WRONG feedback
- Hint system (word length shown as underscores)

### 6. Scoring
- Time-based scoring
- Cumulative across rounds
- Final leaderboard

### 7. Multi-round Support
- Default 3 rounds
- Automatic drawer rotation
- All players draw equal times

### 8. Real-time Sync
- Socket.io for low latency
- Canvas operation broadcasting
- Player join/leave notifications

---

## Comparison with Kribble 1.0

| Aspect | Kribble 1.0 | Kribble 2.0 |
|--------|-------------|-------------|
| **Architecture** | Direct socket handling | Service-based architecture |
| **Type Safety** | TypeScript | Full TypeScript with strict typing |
| **State Management** | React Contexts | Contexts + Services |
| **Canvas** | DrawingCanvas component | Canvas context + workers |
| **Storage** | JSON file + in-memory | In-memory only (Map) |
| **Deployment** | Docker + Railway | Docker support |
| **Code Organization** | Mixed | Clear service/model separation |
| **Event Handling** | Inline | Centralized socket service |

### Kribble 2.0 Improvements

1. **Better Type Safety** - All events typed with TypeScript
2. **Service Pattern** - Clear separation of concerns
3. **Web Workers** - Offload expensive operations
4. **Better UI** - Tailwind CSS, component library
5. **Scalability** - Room validation, game state machine

---

## Files of Interest

### Must-Read for Implementation

#### Server-Side
| File | Description |
|------|-------------|
| `src/app.ts` | Server entry point, Socket.io setup |
| `src/services/game/GameService.ts` | Core game logic, state machine |
| `src/models/GameModel.ts` | Game state management |
| `src/services/room/RoomService.ts` | Room CRUD operations |
| `src/types/socket/game.ts` | Game event types |
| `src/constants/words.json` | Complete word bank |
| `src/constants/game.ts` | Default settings |

#### Client-Side
| File | Description |
|------|-------------|
| `src/App.tsx` | Main app with routing |
| `src/contexts/socket/index.tsx` | Socket connection handling |
| `src/routes/Game/index.tsx` | Game page layout |
| `src/contexts/game/index.tsx` | Game state management |
| `src/types/socket/index.ts` | Client-side socket types |
| `src/contexts/canvas/index.tsx` | Canvas state |

---

## Configuration

### Environment Variables

#### Server
```
env
PORT=5000
DOODLE_CLIENT_URL=http://localhost:3000
NETLIFY_DOODLE_CLIENT_URL=*.netlify.app
```

#### Client
```
env
REACT_APP_DOODLE_SERVER_URL=http://localhost:5000
```

---

## Conclusion

Kribble 2.0 is a well-architected multiplayer drawing game with:
- Clean separation of concerns (services, models)
- Type-safe communication
- Real-time synchronization
- Scalable room management
- Comprehensive game state handling

The codebase is production-ready with Docker support, proper error handling, and a modular structure that makes it easy to extend and maintain.

---

*Document generated from analysis of Kribble 2.0 codebase*
*Version: 2.0 (doodle-client-main / doodle-server-main)*
