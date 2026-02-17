# Redis Setup Guide for Kribble

## Overview

Redis provides:
- **Session persistence** - User sessions survive server restarts
- **Room state storage** - Active rooms and game states in memory
- **Leaderboards** - Real-time ranking with sorted sets
- **Rate limiting** - Sliding window rate limiting
- **Caching** - Reduce database load
- **Match replay storage** - Store drawing data for replays

## Installation

### Local Development

**Option 1: Docker (Recommended)**
```bash
# Run Redis in Docker
docker run -d --name kribble-redis -p 6379:6379 redis:7-alpine

# Or with Docker Compose
docker-compose up -d redis
```

**Option 2: Native Installation**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Windows (WSL2)
sudo apt-get install redis-server
sudo service redis-server start
```

### Production (Railway/Render)

**Railway:**
1. Add Redis from Railway dashboard
2. Copy `REDIS_URL` from Variables
3. Add to your service environment variables

**Render:**
1. Create Redis instance from Render dashboard
2. Copy internal URL
3. Add as `REDIS_URL` environment variable

## Environment Variables

Add to your `.env` file:

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Optional: Redis with authentication
# REDIS_URL=redis://username:password@host:port/0

# Optional: Redis Cluster
# REDIS_URL=redis://node1:6379,redis://node2:6379,redis://node3:6379
```

## Features Implemented

### 1. Session Management
```typescript
// Store session
await redis.setSession(sessionId, {
  userId: 'user-123',
  username: 'Player1',
  isGuest: false,
  lastActivity: Date.now(),
});

// Get session
const session = await redis.getSession(sessionId);

// Update activity (extends TTL)
await redis.updateSessionActivity(sessionId);
```

### 2. Room State Persistence
```typescript
// Store room
await redis.setRoom(roomId, {
  id: roomId,
  name: 'Fun Room',
  hostId: 'user-123',
  maxPlayers: 8,
  isPrivate: false,
  settings: { roundTime: 60, rounds: 3 },
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// Store game state
await redis.setGameState(roomId, {
  phase: 'drawing',
  currentRound: 1,
  currentWord: 'elephant',
  timeRemaining: 45,
  canvasState: strokes,
});

// Get game state (for reconnection)
const gameState = await redis.getGameState(roomId);
```

### 3. Leaderboards
```typescript
// Update score
await redis.updateLeaderboard(userId, username, score);

// Get top 100
const topPlayers = await redis.getLeaderboard(100);

// Get player rank
const rank = await redis.getPlayerRank(userId);
```

### 4. Rate Limiting
```typescript
// Check rate limit
const result = await redis.checkRateLimit(
  `guess:${userId}`,    // key
  10,                    // max requests
  60                     // window in seconds
);

if (!result.allowed) {
  return { error: 'Rate limit exceeded', resetTime: result.resetTime };
}
```

### 5. Caching
```typescript
// Cache expensive data
await redis.setCache('word-list', words, 300); // 5 minutes

// Get from cache
const words = await redis.getCache('word-list');
```

## Redis Data Structure

### Key Prefixes
- `session:` - User sessions
- `room:` - Room metadata
- `room:players:` - Room player lists
- `room:state:` - Active game states
- `leaderboard:` - Sorted sets for rankings
- `ratelimit:` - Rate limiting windows
- `cache:` - General cache
- `settings:` - User settings
- `achievements:` - User achievements
- `match:` - Match replay data

### TTL (Time To Live)
- **Session**: 24 hours
- **Room**: 2 hours (inactive rooms expire)
- **Game State**: 30 minutes
- **Cache**: 5 minutes
- **Rate Limit**: 1 minute
- **Leaderboard**: 1 minute (cache refresh)
- **Match Replay**: 7 days

## Integration with Socket Handlers

The Redis client is designed to work alongside the existing in-memory room storage. Here's the recommended approach:

```typescript
// In socket handlers, persist important state changes
socket.on('room:create', async (data) => {
  // Create room in memory (existing)
  const room = createRoom(data.name, data.settings);
  
  // Also persist to Redis
  await redis.setRoom(room.id, {
    id: room.id,
    name: room.name,
    hostId: player.id,
    maxPlayers: room.maxPlayers,
    isPrivate: room.isPrivate,
    settings: room.settings,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
});

socket.on('draw:stroke', async (data) => {
  // Update in-memory state
  room.canvasState.push(data.stroke);
  
  // Persist to Redis for crash recovery
  await redis.setGameState(room.id, {
    phase: room.gameState.phase,
    currentRound: room.gameState.currentRound,
    canvasState: room.canvasState,
  });
});
```

## Monitoring

### Health Check Endpoint
```typescript
// Add to your API routes
app.get('/api/health/redis', async (req, res) => {
  const health = await redis.healthCheck();
  const stats = await redis.getStats();
  
  res.json({
    healthy: health.healthy,
    latency: health.latency,
    ...stats,
  });
});
```

### Redis CLI Commands
```bash
# Connect to Redis
redis-cli

# Monitor all commands
MONITOR

# Check memory usage
INFO memory

# List all keys
KEYS *

# Get key count
DBSIZE

# Check specific key
GET session:abc123
TTL session:abc123

# Delete all keys (DANGER!)
FLUSHALL
```

## Troubleshooting

### Connection Issues
```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# Check if Redis is running
redis-cli info server
```

### Common Errors

**Error: `ECONNREFUSED`**
- Redis is not running
- Wrong host/port in REDIS_URL

**Error: `NOAUTH`**
- Redis requires password
- Add password to REDIS_URL: `redis://:password@host:port`

**Error: `OOM` (Out of Memory)**
- Redis maxmemory reached
- Configure eviction policy: `maxmemory-policy allkeys-lru`

### Performance Tips

1. **Use pipelining** for batch operations
2. **Set appropriate TTLs** to prevent memory bloat
3. **Use connection pooling** (ioredis handles this automatically)
4. **Monitor memory usage** with `INFO memory`
5. **Enable persistence** in production (AOF or RDB)

## Production Checklist

- [ ] Redis instance created (Railway/Render/AWS)
- [ ] `REDIS_URL` environment variable set
- [ ] Redis password configured (if required)
- [ ] Memory limits configured
- [ ] Persistence enabled (AOF recommended)
- [ ] Monitoring alerts set up
- [ ] Backup strategy in place
- [ ] Failover/replication configured (for high availability)

## Next Steps

1. Integrate Redis into socket handlers for room persistence
2. Add session management to auth routes
3. Implement leaderboard API endpoints
4. Add match replay storage
5. Configure Redis for production deployment

## Resources

- [Redis Documentation](https://redis.io/documentation)
- [ioredis GitHub](https://github.com/luin/ioredis)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
