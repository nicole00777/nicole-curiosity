# Changelog - Curiosity Box

---

## [1.5] 2026-03-03 - Security, Stability and Maintainability

### Security
- API requests time out after 30s via AbortController
- Password input limited to 64 characters
- autocomplete=current-password added

### Stability
- Offline/online toast notifications
- localStorage writes wrapped in try/catch
- Empty catch blocks now log console.error
- Abort errors handled with distinct message

### Maintainability
- JS constants at top of script: MAX_BATCHES, API_TIMEOUT_MS, MAX_PW_LENGTH
- CSS has 12 labeled section comments
- Spacing scale variables: --space-xs through --space-xl

---

## [1.4] 2026-03-03 - UX Improvements

### Error Handling
- Warning icon added to error messages via CSS
- Network errors use toast
- showToast() helper added

### Empty States
- Archive empty: icon + call to action
- Search no results: friendly message
- Starred empty: helpful hint

### Accessibility
- focus-visible keyboard styles
- aria-label on Generate, Settings, filter buttons
- aria-live on loading area
- role=status on empty states
- lang=en on html tag

---

## [1.3] 2026-03-03 - Visual Design System

### Spacing
- All padding/margin/gap on 8px grid

### Typography
- 4 clear levels: titles / 16px body / 13px supporting / 11px labels
- Removed intermediate sizes like 9px, 12.5px

### Colors
- --accent and --accent-text in all themes
- Linen: all hardcoded colors use CSS variables

---

## [1.2] 2026-03-03 - Mobile Optimization

- Sticky archive toolbar
- Password input flexible width
- Touch targets minimum 44x44px
- Theme dots 24px
- Date hidden on mobile nav
- 16px body text (prevents iOS zoom)
- Mood chips wrap on small screens

---

## [1.1] 2026-03-03 - Theme and UI Polish

- Date format: TODAY IS WEEKDAY, DATE
- Olive: card/button color #d8e8c8
- Amber: fun bits contrast improved, warm pastel bubbles
- Ocean: save modal border-only selection, muted save button
- Knowledge Diet bubbles theme-aware colors

---

## [1.0] 2026-03-02 - Initial Build

- 5-theme system: Linen, Amber, Olive, Ocean
- Anthropic API generation with password
- Archive: search, filter, star, date groups
- EN/Chinese toggle per card
- Save as image: 6 styles x 3 ratios
- Sidebar: bubbles, picks, reading links
- Fun bits section
- Supabase auth
- Flappy Bird easter egg
