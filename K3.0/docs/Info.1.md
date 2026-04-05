Good.

Now we're not talking about fixing UI.

We're designing **Kribble 3.0 — Full System Architecture**.

Not just canvas.

Not just drawing.

A complete cross-device multiplayer drawing game platform.

This is going to be a **real product blueprint**, not ideas.

You want:

* Gmail + Guest login
* Proper main hub
* Room system
* Advanced drawing engine (CSP/PS style viewport)
* Advanced game engine
* Advanced state machine
* Separate mobile & desktop experiences (not responsive shrink)
* Production stability

Good.

We build this like a real SaaS.

---

# 🧠 KRIBBLE 3.0 — SYSTEM VISION

Kribble 3.0 is:

> A deterministic real-time multiplayer drawing game engine with advanced canvas core and device-specific UX layers.

We split it into:

```
Client (Web App)
Backend (Realtime + Auth + Persistence)
Shared Game Protocol Layer
Drawing Engine Core
Game State Engine
Device-Specific UI Shell
```

---

# 🏗 GLOBAL ARCHITECTURE

```
Monorepo
├── apps/
│   ├── web-desktop
│   ├── web-mobile
│   └── server
├── packages/
│   ├── drawing-engine
│   ├── game-engine
│   ├── protocol
│   └── shared-types
```

Why?

Because:

* Drawing engine must not depend on UI.
* Game engine must not depend on React.
* Protocol must be shared between client and server.

---

# 🔐 AUTH SYSTEM (LOGIN PAGE)

## Page: `/auth`

### Login Options:

1. Continue with Google
2. Continue as Guest

---

## Gmail Login (Production Setup)

Use:

* Firebase Auth OR Supabase Auth OR Auth0

Flow:

```
User → Google OAuth → ID Token → Server verification → Session created
```

Server stores:

```
User {
  id
  email
  displayName
  avatar
  createdAt
  rating
  stats
}
```

---

## Guest Login

Guest flow:

```
User clicks "Play as Guest"
Server creates temp user
Returns:
{
  userId,
  guestToken
}
```

Guests:

* No persistent stats
* Auto-expire after 7 days

---

# 🏠 MAIN HUB PAGE (DESKTOP)

Route: `/home`

Layout:

```
Left Sidebar:
- Profile
- Stats
- Settings
- Logout

Center:
- Create Room
- Join by Code
- Public Rooms List
- Featured Rooms

Right:
- Friends
- Recent Games
```

---

## Main Features

### 1️⃣ Profile Panel

* Avatar
* Username
* XP Level
* Win Rate
* Drawing Accuracy Score
* Rank Tier

---

### 2️⃣ Create Room

Options:

* Public / Private
* Max players
* Round time
* Custom word packs
* Canvas sNaN support layers internally.

```
Layer {
  id
  visible
  opacity
  blendMode
  commands[]
}
```

Game mode:

* Only 1 layer active.
* But engine supports more.

Future-proofing.

---

# 🧠 GAME ENGINE 3.0

Independent from UI.

State Machine:

```
Lobby
→ Starting
→ WordSelection
→ Drawing
→ Guessing
→ RoundEnd
→ GameEnd
```

Each state has:

```
enter()
update()
exit()
```

Server authoritative.

---

# 🌐 MULTIPLAYER ARCHITECTURE

WebSocket only.

Never poll.

Protocol examples:

```
CLIENT → SERVER
{
  type: "stroke:start"
}
{
  type: "stroke:update"
}
{
  type: "stroke:end"
}
{
  type: "guess"
}
```

Server validates and broadcasts.

All drawing is:
Command-based.
Not bitmap streaming.

---

# 🧮 ADVANCED GAME LOGIC

Scoring based on:

* Guess speed
* Drawing clarity (AI optional)
* Word difficulty

Add:

* Anti-cheat word reveal detection
* Guess spam prevention
* AFK detection
* Disconnect recovery

---

# 📦 PERSISTENCE

Database tables:

Users
Rooms
RoomPlayers
GameHistory
StrokeLogs
Stats

Store:

* Replayable command logs.
* Not images.

---

# 🧪 STABILITY SYSTEM

You need:

* Heartbeat ping system
* Reconnect logic
* Server authoritative state
* Room state snapshot sync
* Client state reconciliation

---

# 🎨 UI ENGINE DIFFERENT FOR DEVICES

Do NOT use CSS only.

Use:

```
if (isMobile)
  load mobile routes
else
  load desktop routes
```

Two separate layout trees.

Shared engine underneath.

---

# ⚡ PERFORMANCE TARGETS

Desktop:

* 60fps
* 10k strokes
* 100k points replay

Mobile:

* 30-60fps
* Limited smoothing
* Lower resolution DPR

---

# 🧠 WHAT KRIBBLE 3.0 BECOMES

Not just a game.

It becomes:

> A modular multiplayer drawing platform.

Future expansions:

* Custom lobbies
* Creative mode
* Drawing tournaments
* Ranked mode
* AI judge mode

---

# 🚀 IF WE BUILD THIS CORRECTLY

Kribble 3.0 will be:

* Stable
* Deterministic
* Scalable
* Cross-device optimized
* Expandable for years

---

Now the real question:

Do you want next:

1️⃣ Full folder structure with exact file names
2️⃣ Backend architecture (Node + WebSocket + DB schema)
3️⃣ Drawing Engine 3.0 full rewrite blueprint
4️⃣ Game State Machine full implementation plan
5️⃣ Dev roadmap (week-by-week build order)

Choose what we design first.

We're building a real product now.
