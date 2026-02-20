# Kribble 2.0 - Remove Tailwind & Apply Kribble 1.0 Styling

## Task Progress

### Phase 1: Remove Tailwind from Project
- [x] Edit package.json - Remove tailwindcss, craco, and related dependencies
- [x] Delete tailwind.config.js
- [x] Delete craco.config.js
- [x] Update index.css - Remove @tailwind directives

### Phase 2: Create CSS Design System
- [x] Create src/styles/design-system.css - CSS variables and design tokens
- [x] Create src/styles/global.css - Global component styles
- [x] Create component-specific CSS files

### Phase 3: Update Components
- [x] Update App.tsx + App.css
- [x] Update Button component
- [x] Update Input component
- [x] Update Card component
- [x] Update Modal/Dialog component
- [x] Update Loading component
- [x] Update Error/ErrorBoundary component
- [x] Update Avatar component
- [x] Update Text component
- [x] Update Tooltip component
- [x] Update Backdrop component
- [x] Update Snackbar component

### Phase 4: Update Pages
- [x] Update Home page
- [x] Update Game page (index.tsx)
- [x] Update Game/Main component
- [x] Update Game/Status components (Lobby, ChooseWord, TurnEnd, RoundStart, Result)

### Phase 5: Update Context Providers
- [x] Update Socket context
- [x] Update Game context
- [x] Update Room context
- [x] Update User context
- [x] Update Canvas context
- [x] Update Snackbar context

### Phase 6: Testing
- [x] Test the application builds
- [ ] Test all pages render correctly
- [ ] Test all functionality works

## Summary

Successfully removed Tailwind CSS from Kribble 2.0 and applied Kribble 1.0 styling:

1. **Removed Tailwind dependencies** from package.json
2. **Deleted configuration files**: tailwind.config.js, craco.config.js
3. **Created CSS Design System**:
   - `src/styles/design-system.css` - CSS variables, design tokens, animations
   - `src/styles/global.css` - Global component styles (buttons, inputs, cards, etc.)
4. **Updated index.css** - Removed Tailwind directives, kept custom properties
5. **Refactored Game UI** with modern glassmorphism design:
   - Created `GameLayout.css` with glass panels, animated gradients
   - New layout: 5vh top/bottom bars, 10vw sidebars, 80vw×90vh canvas
   - Moved drawing toolbar to bottom bar for better UX
6. **Updated components** to use CSS classes instead of Tailwind utility classes
7. **Build successful** - 141.22 kB JS, 4.2 kB CSS

## Files Modified/Created

### New Files:
- `src/styles/design-system.css`
- `src/styles/global.css`
- `src/routes/Game/GameLayout.css`

### Modified Files:
- `package.json` - Removed Tailwind dependencies
- `src/index.css` - Removed Tailwind directives
- `src/components/Button/index.tsx` - Updated to use CSS classes
- `src/components/Button/utils.ts` - Updated class sources
- `src/components/Loading/index.tsx` - Updated to use CSS classes
- `src/components/Text/index.tsx` - Updated to use CSS classes
- `src/components/Backdrop/index.tsx` - Updated to use CSS classes
- `src/components/Dialog/index.tsx` - Updated to use CSS classes
- `src/components/Snackbar/index.tsx` - Updated to use CSS classes
- `src/components/Tooltip/index.tsx` - Updated to use CSS classes
- `src/components/Button/IconButton/index.tsx` - Updated to use CSS classes
- `src/routes/Home/index.tsx` - Updated to use CSS classes
- `src/routes/Game/index.tsx` - Complete redesign with new layout
- `src/routes/Game/Main/index.tsx` - Extracted Toolbar component
- `src/routes/Game/Mobile/index.tsx` - Updated for new layout
- `src/contexts/canvas/index.tsx` - Fixed TypeScript types

### Deleted Files:
- `tailwind.config.js`
- `craco.config.js`
