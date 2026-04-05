# K3.0 Database Tables and Programming Languages

## Database Tables (from Prisma schema.prisma)
The K3.0 backend uses **PostgreSQL** (datasource in schema.prisma) with the following Prisma models (tables):

### User
| Field | Type | Constraints | PK/FK | Relations |
|-------|------|-------------|--------|-----------|
| id | String | @default(uuid()) | **PK** | - |
| email | String? | @unique | - | - |
| guestId | String? | @unique | - | - |
| username | String | @unique | - | - |
| avatar | String? | - | - | - |
| isGuest | Boolean | @default(false) | - | - |
| createdAt | DateTime | @default(now()) | - | - |
| rooms | RoomPlayer[] | - | - | RoomPlayer (one-to-many) |
| stats | Json? | - | - | - |

**Indexes**: [guestId]

### Room
| Field | Type | Constraints | PK/FK | Relations |
|-------|------|-------------|--------|-----------|
| id | String | @default(uuid()) | **PK** | - |
| code | String | @unique | - | - |
| name | String | - | - | - |
| maxPlayers | Int | @default(8) | - | - |
| isPrivate | Boolean | @default(false) | - | - |
| status | RoomStatus | @default(LOBBY) | - | - |
| players | RoomPlayer[] | - | - | RoomPlayer (one-to-many) |
| createdAt | DateTime | @default(now()) | - | - |

### RoomPlayer
| Field | Type | Constraints | PK/FK | Relations |
|-------|------|-------------|--------|-----------|
| id | String | @default(uuid()) | **PK** | - |
| userId | String | - | **FK** | User (many-to-one) |
| roomId | String | - | **FK** | Room (many-to-one) |
| isDrawer | Boolean | @default(false) | - | - |
| score | Int | @default(0) | - | - |
| isReady | Boolean | @default(false) | - | - |
| hasGuessedCorrectly | Boolean | @default(false) | - | - |

**Unique**: [userId, roomId]

### GameHistory
| Field | Type | Constraints | PK/FK | Relations |
|-------|------|-------------|--------|-----------|
| id | String | @default(uuid()) | **PK** | - |
| roomId | String | - | - | - |
| players | Json | - | - | - |
| winnerId | String | - | - | - |
| scores | Json | - | - | - |
| playedAt | DateTime | @default(now()) | - | - |

### StrokeLog
| Field | Type | Constraints | PK/FK | Relations |
|-------|------|-------------|--------|-----------|
| id | String | @default(uuid()) | **PK** | - |
| gameId | String | - | - | - |
| userId | String | - | - | - |
| points | Json | - | - | - |
| color | String | - | - | - |
| size | Float | - | - | - |
| timestamp | DateTime | @default(now()) | - | - |

**Enum**: RoomStatus (LOBBY, DRAWING, GUESSING, ROUND_END, GAME_END)

Schema location: `K3.0/apps/server/prisma/schema.prisma`

## Programming Languages and Frameworks

### Backend (K3.0/apps/server)
- **TypeScript** (primary language, all .ts files, tsconfig.json)
- Prisma ORM for database
- Node.js (inferred from server structure)
- WebSocket server (src/ws/)

### Frontend
#### Web Desktop (K3.0/apps/web-desktop)
- **React** (^18.2.0)
- **TypeScript** (^5.2.0)
- **Tailwind CSS** (^3.3.5)
- **Vite** (^4.5.0) (build tool)
- Zustand (state management)
- React Router DOM

#### Web Mobile (K3.0/apps/web-mobile)
- **React** (^18.2.0)
- **TypeScript** (^5.2.0)
- **Vite** (^4.5.0) (build tool)
- React Router DOM

Shared packages (drawing-engine, game-engine, shared-types): **TypeScript**.

**Note**: All frontend/backend code uses TypeScript (.ts/.tsx files). No other languages detected in K3.0.
