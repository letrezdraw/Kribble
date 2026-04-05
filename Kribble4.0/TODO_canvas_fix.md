# Canvas Flicker/Smoothing Fix - Kribble4.0
BLACKBOXAI/branches/fix-canvas-flicker

## Progress
- [x] Create TODO.md
- [x] 1. Optimize CanvasEngine.ts: Add RAF throttling to renderLiveStroke (`scheduleLiveRender`), implement `smoothPoints` EMA + skip distant, `computeVariableWidth` pressure/velocity modulation
- [x] 2. Update DrawingCanvasV2.tsx: Add `will-change: transform` for GPU accel on canvases
- [ ] 3. Test in dev: cd Kribble4.0/client && npm i && npm run dev → GameRoom → Draw (mouse/pen), verify no flicker/thick lines/smoothing
- [ ] 4. Update progress in this file after each step
- [ ] 5. Commit & PR
- [ ] 4. Update progress in this file after each step
- [ ] 5. Commit & PR

## Testing Commands
```
cd Kribble4.0/client
npm install
npm run dev
# Navigate to /room/XXXX?drawer=true (force drawer mode), test drawing fast circles/lines
```

## Success Criteria
- No flickering during draw (live canvas stable)
- Consistent line thickness (no blobs/strain)
- Smooth curves (no jagged/stair-step)
- 60fps smooth (Chrome DevTools → Performance)
