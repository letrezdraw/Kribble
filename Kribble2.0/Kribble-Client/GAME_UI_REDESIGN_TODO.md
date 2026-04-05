# Game UI Redesign TODO

## Changes Made:

### 1. Canvas Background ✅
- [x] Changed canvas background from `--dark-board-green` to `white`

### 2. Desktop Layout (Game/index.tsx) ✅
- [x] Top Bar: 5vh height - DetailBar (timer, word, round)
- [x] Left Bar: 10vw width - Players list (DoodlerList)
- [x] Right Bar: 10vw width - Chat (HunchList)
- [x] Bottom Bar: 5vh height - Drawing Toolbar (Main component)
- [x] Center: 80vw x 90vh - Canvas area
- [x] Converted inline CSS to proper CSS file (`GameLayout.css`)

### 3. Mobile Layout ✅
- [x] Created separate mobile detection hook (`useMobile.ts`)
- [x] Created mobile-specific layout with tab navigation (`Mobile/index.tsx`)
- [x] Canvas takes priority on mobile
- [x] Converted inline CSS to CSS classes

### 4. Modern Glassmorphism Design ✅
- [x] Animated gradient background with floating orbs
- [x] Glass panels with `backdrop-filter: blur()`
- [x] Smooth hover transitions and animations
- [x] Gradient border effects on hover
- [x] Modern scrollbar styling
- [x] Animated tab indicators for mobile

### 5. Preserve Logic ✅
- [x] All socket events unchanged
- [x] All game state management preserved
- [x] Canvas drawing functionality intact
- [x] All status components work as before

## Files Created/Modified:
1. `src/routes/Game/GameLayout.css` - NEW: Complete CSS design system
2. `src/routes/Game/index.tsx` - Updated to use CSS classes
3. `src/routes/Game/Mobile/index.tsx` - Updated to use CSS classes
4. `src/routes/Game/components/Canvas/index.tsx` - White background

## Build Status:
✅ Compiled successfully!
- 142.35 kB JS bundle
- 4.2 kB CSS bundle
