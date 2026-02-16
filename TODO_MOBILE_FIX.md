# Mobile GameRoom Fixes - TODO

## Tasks:
- [x] Fix mobile height/viewport issues (GameRoomMobile.css)
  - Replace 100vh with 100dvh
  - Add safe area insets
  - Fix toolbar positioning
  
- [x] Fix touch drawing system (DrawingCanvas.tsx)
  - Add gesture state machine
  - Separate single-touch from multi-touch
  - Prevent drawing during gestures
  
- [x] Add mobile gesture support (DrawingCanvas.tsx)
  - Two-finger pan
  - Pinch-to-zoom
  - Gesture thresholds
  
- [x] Update CSS for mobile (DrawingCanvas.css)
  - Add mobile-specific touch styles
  - Prevent text selection
  - Optimize hit areas
  
- [x] Test mobile functionality
  - Verify height fixes
  - Test touch drawing
  - Test gestures
