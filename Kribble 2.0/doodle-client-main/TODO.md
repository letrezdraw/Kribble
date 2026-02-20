# Kribble 2.0 - Remove Tailwind & Apply Kribble 1.0 Styling

## Task Progress

### Phase 1: Remove Tailwind from Project
- [ ] Edit package.json - Remove tailwindcss, craco, and related dependencies
- [ ] Delete tailwind.config.js
- [ ] Delete craco.config.js
- [ ] Update index.css - Remove @tailwind directives

### Phase 2: Create CSS Design System
- [ ] Create src/styles/design-system.css - CSS variables and design tokens
- [ ] Create src/styles/global.css - Global component styles
- [ ] Create component-specific CSS files

### Phase 3: Update Components
- [ ] Update App.tsx + App.css
- [ ] Update Button component
- [ ] Update Input component
- [ ] Update Card component
- [ ] Update Modal/Dialog component
- [ ] Update Loading component
- [ ] Update Error/ErrorBoundary component
- [ ] Update Avatar component
- [ ] Update Text component
- [ ] Update Tooltip component
- [ ] Update Backdrop component
- [ ] Update Snackbar component

### Phase 4: Update Pages
- [ ] Update Home page
- [ ] Update Game page (index.tsx)
- [ ] Update Game/Main component
- [ ] Update Game/Status components (Lobby, ChooseWord, TurnEnd, RoundStart, Result)

### Phase 5: Update Context Providers
- [ ] Update Socket context
- [ ] Update Game context
- [ ] Update Room context
- [ ] Update User context
- [ ] Update Canvas context
- [ ] Update Snackbar context

### Phase 6: Testing
- [ ] Test the application builds
- [ ] Test all pages render correctly
- [ ] Test all functionality works
