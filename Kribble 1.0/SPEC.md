# Kribble - Multiplayer Drawing & Guessing Game

## Project Overview

**Project Name:** Kribble
**Project Type:** Real-time Multiplayer Web Game
**Core Functionality:** A multiplayer drawing and guessing game (Pictionary-style) where players take turns drawing words while others guess to earn points.
**Target Users:** Casual gamers, friends, party groups, and online communities looking for a fun, social drawing game.

---

## Technical Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript |
| Canvas | Fabric.js (for vector drawing) + custom WebGL layer |
| Real-time | Socket.io (WebSockets) |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite (development) / PostgreSQL (production) |
| Caching | In-memory (development) / Redis (production) |
| Authentication | JWT + OAuth (Google, Discord) |
| Deployment | Docker + Kubernetes-ready |

### Project Structure

```
kribble/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── contexts/          # React contexts (auth, game)
│   │   ├── services/          # API services
│   │   ├── utils/             # Utility functions
│   │   ├── types/             # TypeScript types
│   │   ├── styles/            # CSS/styled components
│   │   └── pages/             # Page components
│   └── public/
├── server/                    # Node.js backend
│   ├── src/
│   │   ├── controllers/       # Route controllers
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Express middleware
│   │   ├── models/            # Data models
│   │   ├── socket/            # Socket.io handlers
│   │   ├── utils/             # Utilities
│   │   └── types/             # TypeScript types
│   └── data/                  # SQLite database
└── shared/                    # Shared types/constants
```

---

## UI/UX Specification

### Color Palette

| Role | Color | Hex Code |
|------|-------|----------|
| Primary Background | Deep Navy | #0D1B2A |
| Secondary Background | Dark Slate | #1B263B |
| Card Background | Midnight Blue | #243447 |
| Primary Accent | Electric Cyan | #00F5D4 |
| Secondary Accent | Vibrant Purple | #9B5DE5 |
| Warning/Alert | Coral Orange | #F15BB5 |
| Success | Mint Green | #00F5A0 |
| Text Primary | Pure White | #FFFFFF |
| Text Secondary | Silver Gray | #A0AEC0 |
| Text Muted | Slate Gray | #64748B |
| Drawing Canvas BG | Off-White | #F8FAFC |
| Player Card Host | Gold | #FFD700 |
| Player Card Moderator | Crimson | #DC143C |

### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Logo/Brand | "Fredoka One", cursive | 400 | 48px |
| Headings H1 | "Nunito", sans-serif | 800 | 32px |
| Headings H2 | "Nunito", sans-serif | 700 | 24px |
| Headings H3 | "Nunito", sans-serif | 600 | 20px |
| Body Text | "Nunito", sans-serif | 400 | 16px |
| Small Text | "Nunito", sans-serif | 400 | 14px |
| Timer/Numbers | "JetBrains Mono", monospace | 700 | 28px |
| Chat Messages | "Nunito", sans-serif | 400 | 15px |

### Spacing System

- Base unit: 4px
- XS: 4px
- SM: 8px
- MD: 16px
- LG: 24px
- XL: 32px
- XXL: 48px

### Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| Mobile | < 640px | Phones |
| Tablet | 640px - 1024px | Tablets |
| Desktop | > 1024px | Desktops |
| Wide | > 1440px | Large screens |

### Visual Effects

- **Card shadows:** `0 4px 20px rgba(0, 245, 212, 0.15)`
- **Glow effects:** `0 0 20px rgba(0, 245, 212, 0.4)` on hover
- **Glass morphism:** `backdrop-filter: blur(10px); background: rgba(27, 38, 59, 0.8)`
- **Transitions:** All interactive elements use `transition: all 0.2s ease`
- **Button hover:** Scale 1.05 with glow
- **Page transitions:** Fade-in with 0.3s duration

---

## Page Structure

### 1. Landing Page (`/`)

**Layout:**
- Full-screen hero with animated background (particles/gradient)
- Centered content with logo, tagline, and CTA buttons
- Features showcase in 3-column grid
- Footer with links

**Components:**
- Animated logo with pulse effect
- "Play as Guest" button (primary, glowing)
- "Login" button (secondary, outlined)
- "Create Private Room" button
- Feature cards with icons and hover effects

### 2. Login/Register Page (`/login`)

**Layout:**
- Split screen: left side illustration, right side form
- Form centered vertically on mobile

**Components:**
- OAuth buttons (Google, Discord)
- Divider with "or"
- Email input
- Password input with show/hide toggle
- "Remember me" checkbox
- Submit button
- Link to register

### 3. Lobby Page (`/lobby`)

**Layout:**
- Header with logo, user avatar, and menu
- Main content: Room list (grid of room cards)
- Sidebar: Quick stats, leaderboard preview
- Footer: Create room button

**Components:**
- Room cards showing:
  - Room name
  - Player count (e.g., "5/8 players")
  - Game mode icon
  - Join button
- Filter tabs: All, Public, Private, Ranked
- Search bar
- Create Room modal

### 4. Create Room Modal

**Components:**
- Room name input
- Privacy toggle (Public/Private)
- Password input (if private)
- Max players slider (2-16)
- Round time selector (30s, 60s, 90s, 120s)
- Categories checkboxes
- "Drawing words only" toggle
- Start game button

### 5. Game Room Page (`/room/:id`)

**Layout:**
- Header: Room name, player list, settings
- Main area: 
  - Left: Drawing canvas (70%)
  - Right: Chat & guessing panel (30%)
- Bottom: Toolbar (drawing tools)
- Top bar: Timer, word hint, score

**Components:**

#### Canvas Area
- Drawing canvas (Fabric.js)
- Current word display (with hint: "_ _ _ _ _")
- Timer bar (animated countdown)
- Round indicator ("Round 2/6")
- Skip vote button

#### Toolbar
- Brush tool
- Eraser tool
- Shape tool (dropdown: line, rectangle, circle, arrow)
- Text tool
- Color picker (palette + custom)
- Brush size slider (1-50px)
- Brush opacity slider
- Undo/Redo buttons
- Clear canvas button
- Layers button

#### Player List
- Player avatar
- Player name
- Score
- Crown icon for drawer
- Host/Moderator badge

#### Chat Panel
- Tab switcher: Chat / Guesses / Scores
- Message list with:
  - Player avatar
  - Player name
  - Message content
  - Timestamp
- Correct guess: highlighted in green with confetti
- Input field with send button

### 6. Profile Page (`/profile`)

**Layout:**
- Profile header with avatar, level, XP bar
- Stats grid
- Achievements section
- Match history table

**Components:**
- Avatar editor (unlockable)
- Level progress bar
- Stats cards:
  - Games played
  - Win rate
  - Average score
  - Words drawn
  - Words guessed
  - Total time played
- Achievement badges (unlockable)
- Match history with:
  - Date
  - Players
  - Score
  - Placement

### 7. Settings Page (`/settings`)

**Layout:**
- Tabbed interface

**Tabs:**
- Account (email, password, OAuth)
- Preferences (theme, sound, language)
- Privacy (profile visibility, chat)
- Notifications (email, push)

---

## Component Specifications

### Button Component

```
States:
- Default: Background #243447, text #FFFFFF
- Hover: Background #00F5D4, text #0D1B2A, scale(1.05), glow
- Active: scale(0.98)
- Disabled: opacity 0.5, cursor not-allowed

Variants:
- Primary: Filled with accent color
- Secondary: Outlined
- Ghost: Transparent with hover fill
- Danger: Red accent for destructive actions
```

### Input Component

```
States:
- Default: Background #1B263B, border #64748B
- Focus: Border #00F5D4, glow effect
- Error: Border #F15BB5
- Disabled: opacity 0.5
```

### Card Component

```
- Background: #243447
- Border-radius: 16px
- Padding: 24px
- Shadow: 0 4px 20px rgba(0, 245, 212, 0.1)
- Hover: translateY(-4px), increased shadow
```

### Modal Component

```
- Backdrop: rgba(0, 0, 0, 0.7) with blur
- Content: Glass morphism effect
- Animation: Scale from 0.9 to 1, fade in
- Close button: Top right corner
```

### Toast Notifications

```
Types:
- Success: Green border, checkmark icon
- Error: Red border, X icon
- Warning: Orange border, warning icon
- Info: Cyan border, info icon

Animation: Slide in from top-right, auto-dismiss after 5s
```

---

## Game Logic Specification

### Game Flow

1. **Lobby Phase**
   - Players join room
   - Host configures settings
   - Host starts game

2. **Selection Phase** (10s)
   - System selects drawer
   - System selects word from category
   - Word displayed as blanks to guessers

3. **Drawing Phase**
   - Timer counts down (configurable: 30-120s)
   - Drawer draws the word
   - Guessers submit guesses
   - Correct guess: +points, new guesser can still guess
   - Hints available (3 hints max, reveal letters)

4. **Round End**
   - Show correct word
   - Update scores
   - Rotate drawer

5. **Game End**
   - Show final rankings
   - Award XP based on performance
   - Option to play again

### Scoring System

| Action | Points |
|--------|--------|
| Correct guess (first) | 100 |
| Correct guess (2nd) | 80 |
| Correct guess (3rd) | 60 |
| Correct guess (4th+) | 40 |
| Time bonus | +1 per second remaining |
| Drawing (participation) | 10 |

### Word Categories

- Animals (500+ words)
- Movies (400+ words)
- Objects (600+ words)
- Food (350+ words)
- Countries (200+ words)
- Sports (250+ words)
- Music (200+ words)
- Famous People (150+ words)
- Random (all categories)

---

## Real-Time Communication Specification

### Socket Events

#### Client → Server
```
typescript
// Room management
'room:create' → { name, settings }
'room:join' → { roomId, password? }
'room:leave' → { }
'room:kick' → { playerId }
'room:start' → { }

// Game actions
'draw:stroke' → { stroke: StrokeData }
'draw:clear' → { }
'draw:undo' → { }
'guess:submit' → { guess: string }
'hint:request' → { }

// Chat
'chat:message' → { message: string }
'chat:mute' → { playerId, duration }
```

#### Server → Client
```
typescript
// Room updates
'room:created' → { room: Room }
'room:joined' → { room: Room, player: Player }
'room:player-joined' → { player: Player }
'room:player-left' → { playerId: string }
'room:updated' → { room: Room }

// Game updates
'game:starting' → { round: number, totalRounds: number }
'game:word-selected' → { word: string, blanks: string, hints: number }
'game:drawer-changed' → { drawerId: string }
'game:timer-update' → { timeRemaining: number }
'game:guess-correct' → { playerId: string, word: string, points: number }
'game:round-end' → { word: string, scores: Score[] }
'game:end' → { finalScores: Score[], rankings: Ranking[] }

// Drawing sync
'draw:stroke' → { playerId: string, stroke: StrokeData }
'draw:clear' → { playerId: string }
'draw:undo' → { playerId: string }

// Chat
'chat:message' → { player: Player, message: string, timestamp: Date }
'chat:system' → { message: string }
```

### Reconnection Strategy

1. On disconnect: Show "Reconnecting..." overlay
2. Server keeps session for 30 seconds
3. Client attempts reconnection every 2 seconds
4. On success: Sync current game state
5. On timeout: Redirect to lobby with "Connection lost" message

---

## Canvas Drawing Specification

### Stroke Data Structure

```
typescript
interface Stroke {
  id: string;
  tool: 'brush' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'text';
  points: Point[];
  color: string;
  size: number;
  opacity: number;
  pressure?: number[];
  timestamp: number;
}
```

### Drawing Features

| Feature | Implementation |
|---------|----------------|
| Brush | Variable width based on pressure |
| Eraser | Remove strokes intersecting with path |
| Shapes | Click-drag to create, snap to grid option |
| Text | Click to place, type to enter text |
| Smoothing | Bezier curve interpolation |
| Layers | Separate canvas groups |
| Undo/Redo | Command stack (max 50 actions) |

### Performance Optimizations

- Debounce stroke events (16ms)
- Send compressed stroke data
- Client-side prediction
- Interpolate incoming strokes

---

## Database Schema

### SQLite Tables

```
sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  avatar_id TEXT DEFAULT 'default',
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Matches
CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  room_id TEXT,
  started_at DATETIME,
  ended_at DATETIME,
  winner_id TEXT
);

-- Match Players
CREATE TABLE match_players (
  match_id TEXT,
  player_id TEXT,
  score INTEGER DEFAULT 0,
  words_drawn INTEGER DEFAULT 0,
  words_guessed INTEGER DEFAULT 0,
  PRIMARY KEY (match_id, player_id)
);

-- Word Categories
CREATE TABLE word_categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  words TEXT NOT NULL -- JSON array
);

-- Achievements
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  player_id TEXT,
  achievement_id TEXT,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Security Specification

### Authentication
- JWT access tokens (15 min expiry)
- Refresh tokens (7 days expiry, httpOnly cookie)
- CSRF protection on all forms

### Rate Limiting
- Guess submissions: 5 per second
- Chat messages: 3 per second
- Drawing strokes: 60 per second

### Input Validation
- All inputs sanitized
- XSS prevention
- SQL injection prevention (parameterized queries)
- Max message length: 500 chars
- Max room name: 50 chars

### Moderation
- Profanity filter on chat and usernames
- Word blacklist for drawing prompts
- Auto-mute on spam (3 violations = 60s mute)
- Host can kick/b mute players

---

## Acceptance Criteria

### Core Gameplay
- [ ] Players can create and join rooms
- [ ] Drawing canvas is smooth with low latency (<50ms)
- [ ] Strokes sync to all players in real-time
- [ ] Guessing system correctly identifies matches
- [ ] Timer counts down and triggers round end
- [ ] Scores update correctly for all players
- [ ] Game progresses through all rounds
- [ ] Final rankings display at game end

### Drawing Tools
- [ ] Brush tool with variable size
- [ ] Eraser removes drawings
- [ ] Shape tools create shapes
- [ ] Color picker works
- [ ] Undo removes last action
- [ ] Clear canvas works
- [ ] Undo/Redo stack maintains history

### Multiplayer
- [ ] Players can join with username
- [ ] Player list shows all connected players
- [ ] Chat messages appear in real-time
- [ ] Correct guesses highlighted
- [ ] Disconnection handled gracefully

### UI/UX
- [ ] All pages match color scheme
- [ ] Animations are smooth (60fps)
- [ ] Responsive on mobile devices
- [ ] Loading states shown during async operations
- [ ] Error messages displayed clearly

### Performance
- [ ] Initial load < 3 seconds
- [ ] Drawing latency < 50ms
- [ ] Socket reconnection works
- [ ] Memory usage stable during gameplay

---

## Implementation Phases

### Phase 1: Foundation
- Project setup (React + Node.js)
- Basic routing
- Authentication system
- Socket.io connection

### Phase 2: Core Game
- Drawing canvas with Fabric.js
- Basic room creation/joining
- Drawing sync
- Simple guessing

### Phase 3: Game Logic
- Turn management
- Timer system
- Scoring
- Round progression

### Phase 4: Polish
- Complete toolbar
- Chat system
- Player list
- Animations

### Phase 5: Social
- Profiles
- XP/Levels
- Achievements
- Match history

### Phase 6: Scale
- Redis integration
- Load balancing
- Monitoring
- Performance optimization

---

*Last Updated: 2024*
*Version: 1.0.0*
