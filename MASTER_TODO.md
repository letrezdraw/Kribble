# Kribble - Master TODO & Roadmap

## 🎯 Current Status Overview

### ✅ Recently Completed (Last 2 Weeks)
- [x] **Canvas System**: Undo/redo, zoom, rotation, opacity, eraser, fill tool
- [x] **Game Flow**: Round start/end, match end, state sync, drawer rotation
- [x **Auth System**: Guest login fix, JWT tokens, profile management
- [x] **UI/UX**: Login redesign, version display, match end buttons
- [x] **Rejoin Game**: Players can rejoin during active rounds
- [x] **Hint System**: Automatic timed hints during drawing phase
- [x] **XP/Level**: Progress persistence after matches
- [x] **URL Configuration**: Environment-based API/socket URLs

---

## 🚨 CRITICAL - Next Priority

### 1. Comprehensive System Improvements
**Status**: 🔄 IN PROGRESS
**Scope**: Full platform overhaul (game + auth + settings + stats + management)

#### 1.1 Network & Performance
- [ ] **Binary Protocol (MessagePack)**: 50% bandwidth reduction for drawing data
- [ ] **Canvas Delta Compression**: Only send changed regions, not full strokes
- [ ] **WebRTC P2P**: Ultra-low latency for drawing sync (optional fallback to Socket.io)
- [ ] **Connection Resilience**: Auto-reconnect with state recovery

#### 1.2 Infrastructure & Scaling
- [ ] **Redis Persistence**: Room state, player sessions, leaderboards
- [ ] **PostgreSQL Migration**: Move from SQLite for production scale
- [ ] **Docker & Kubernetes**: Containerization for horizontal scaling
- [ ] **CDN Integration**: Static assets, word packs, avatar images
- [ ] **Rate Limiting**: Advanced DDoS protection and abuse prevention

#### 1.3 Security & Anti-Cheat
- [ ] **Server-Side Validation**: All game actions validated server-side
- [ ] **Drawing Replay System**: Store and replay drawings for verification
- [ ] **Word Leak Prevention**: Encrypt word data, only reveal to drawer
- [ ] **Bot Detection**: Pattern analysis for automated players
- [ ] **IP/Device Fingerprinting**: Prevent multi-account abuse

#### 1.4 User Management & Stats
- [ ] **Achievement System**: Complete tracking and unlocking
- [ ] **Match History**: Full persistence with replay viewing
- [ ] **Daily Challenges**: Rotating challenges with rewards
- [ ] **Friend System**: Add friends, invite to games, see online status
- [ ] **Player Reporting**: Report toxic behavior/cheaters
- [ ] **Moderation Tools**: Admin panel for user management

#### 1.5 Settings System
- [ ] **Server-Side Settings**: Persist all settings to database
- [ ] **Theme System**: Multiple themes beyond dark/light
- [ ] **Audio Settings**: Volume controls, mute options
- [ ] **Accessibility**: Colorblind mode, high contrast, screen reader support

---

## 🔧 PENDING FIXES (From Previous TODOs)

### 2. Guest System
- [ ] **Guest Username Prompt**: Allow custom usernames for guests
- [ ] **Guest Account Upgrade**: Convert guest to permanent account
- [ ] **Guest Data Persistence**: Save guest progress for 30 days

### 3. Mobile Experience
- [ ] **Mobile Game Room Layout**: Fix guess input overlapping canvas
- [ ] **Touch Optimization**: Better touch detection, larger touch targets
- [ ] **Mobile Performance**: Reduce canvas resolution on low-end devices
- [ ] **PWA Support**: Offline capability, install prompt, push notifications

### 4. Game Features
- [ ] **Tournament System**: Bracket-style competitions
- [ ] **Matchmaking**: Skill-based player matching
- [ ] **Spectator Mode**: Watch games without playing
- [ ] **Custom Word Packs**: User-created word lists
- [ ] **Drawing Replay**: Watch drawings after match
- [ ] **Emoji Reactions**: React to drawings in real-time

---

## 📋 TECHNICAL DEBT

### 5. Code Quality
- [ ] **TypeScript Strict Mode**: Enable strict type checking
- [ ] **Test Coverage**: Unit tests for game logic, integration tests for API
- [ ] **Error Boundaries**: React error boundaries for all routes
- [ ] **Logging System**: Structured logging with correlation IDs
- [ ] **Performance Monitoring**: Real user metrics, server metrics

### 6. Documentation
- [ ] **API Documentation**: OpenAPI/Swagger specs
- [ ] **Architecture Diagrams**: System design documentation
- [ ] **Deployment Guide**: Step-by-step production deployment
- [ ] **Contributing Guide**: For open-source contributors

---

## 🎨 UI/UX ENHANCEMENTS

### 7. Visual Polish
- [ ] **Loading States**: Skeleton screens, progress indicators
- [ ] **Animations**: Page transitions, micro-interactions
- [ ] **Empty States**: Better "no data" experiences
- [ ] **Error States**: User-friendly error messages with recovery actions
- [ ] **Onboarding**: First-time user tutorial

### 8. Accessibility
- [ ] **Keyboard Navigation**: Full keyboard support
- [ ] **Screen Reader**: ARIA labels, live regions
- [ ] **Color Contrast**: WCAG 2.1 AA compliance
- [ ] **Reduced Motion**: Respect prefers-reduced-motion

---

## 🚀 DEPLOYMENT & DEVOPS

### 9. CI/CD Pipeline
- [ ] **GitHub Actions**: Automated testing, building, deployment
- [ ] **Staging Environment**: Pre-production testing
- [ ] **Database Migrations**: Automated schema updates
- [ ] **Rollback Strategy**: Quick rollback on failure

### 10. Monitoring & Alerting
- [ ] **Uptime Monitoring**: Pingdom/Statuspage integration
- [ ] **Error Tracking**: Sentry integration
- [ ] **Performance Monitoring**: New Relic/DataDog
- [ ] **Log Aggregation**: Centralized logging (ELK/Loki)

---

## 📊 ANALYTICS & BUSINESS

### 11. Analytics
- [ ] **Game Analytics**: Player behavior, retention, churn
- [ ] **Performance Metrics**: Server response times, error rates
- [ ] **Business Metrics**: DAU/MAU, session length, conversion
- [ ] **A/B Testing Framework**: Feature flag system

### 12. Monetization (Future)
- [ ] **Premium Accounts**: Ad-free, exclusive avatars, custom themes
- [ ] **Cosmetic Store**: Avatar frames, drawing effects, emotes
- [ ] **Battle Pass**: Seasonal progression with rewards

---

## 🗂️ COMPLETED (Archive)

<details>
<summary>Click to expand completed work</summary>

### Canvas System (✅ DONE)
- Undo/redo with proper stroke management
- Zoom with mouse wheel and pinch gestures
- Rotation with proper coordinate transformation
- Opacity rendering with save/restore
- Eraser tool (paints with background color)
- Fill tool with undo support
- Layer system with visibility toggle
- Mobile touch support

### Game Logic (✅ DONE)
- Drawer rotation (each player draws once per round)
- Automatic hint system
- Canvas clear on drawer change
- Rejoin game during active round
- Round start/end synchronization
- Match end with scoreboard
- Game state synchronization

### Auth & User (✅ DONE)
- JWT authentication
- Guest login with expiration
- Profile management
- XP/level persistence
- Basic stats tracking

### UI/UX (✅ DONE)
- Login screen redesign
- Version display positioning
- Match end buttons
- Settings UI (visual only)
- Responsive design foundation

### Infrastructure (✅ DONE)
- Environment-based URL configuration
- FileDB with full column support
- Basic rate limiting
- Profanity filter
- Logger utility

</details>

---

## 🎯 IMMEDIATE NEXT STEPS

### This Week (Priority Order):
1. **MessagePack Integration**: Binary protocol for drawing data
2. **Redis Setup**: Session and room state persistence
3. **Server-Side Validation**: Prevent client-side cheating
4. **Achievement System**: Complete the tracking implementation
5. **Settings Persistence**: Connect settings UI to backend

### Next 2 Weeks:
1. **PostgreSQL Migration**: Production database
2. **Canvas Delta Compression**: Optimize drawing sync
3. **Mobile Layout Fixes**: Game room mobile experience
4. **Friend System**: Basic friend management
5. **Drawing Replay**: Store and replay drawings

---

## 📝 NOTES

- **Raster vs Vector**: Keeping raster chunk-based system (agreed - vector would be complete rewrite)
- **Scale Target**: Support 1000+ concurrent rooms, 10,000+ concurrent players
- **Budget Considerations**: Redis + PostgreSQL on Railway/Render, CDN via Cloudflare
- **Tech Stack**: Node.js, Express, Socket.io, React, TypeScript, SQLite → PostgreSQL

---

*Last Updated: 2024*
*Next Review: Weekly*
