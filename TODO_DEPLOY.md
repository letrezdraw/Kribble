# Deployment TODO - PostgreSQL + Render

## Phase 1: Database Layer ✅
- [x] Update server/package.json - Add pg dependency
- [x] Rewrite server/src/db/index.ts - Dual database support (PostgreSQL/SQLite)
- [x] Create server/src/db/schema.sql - Database schema
- [x] Create server/src/db/migrate.ts - Migration runner

## Phase 2: Server Configuration ✅
- [x] Update server/src/index.ts - Environment-based CORS and port
- [x] Create server/.env.example - Environment template

## Phase 3: Render Deployment ✅
- [x] Create render.yaml - Render blueprint

## Phase 4: Client Configuration ✅
- [x] Update client/src/services/api.ts - Dynamic API URL
- [x] Create client/src/vite-env.d.ts - TypeScript types for env vars

## Phase 5: Root Configuration ✅
- [x] Update .gitignore - Add environment files

## Phase 6: Route Updates ✅
- [x] Update server/src/routes/auth.ts - Async database calls
- [x] Update server/src/routes/users.ts - Async database calls
- [x] Update server/src/routes/words.ts - Async database calls
- [x] Update server/src/socket/handlers.ts - Async endGame function

## Guide to Upload on Render ✅
(See DEPLOY_GUIDE.md for complete deployment instructions)
