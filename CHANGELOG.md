# Changelog - Curiosity Box

---

## [1.8] 2026-03-03 - Bug Fixes & Performance

### Bug Fixes
- Fixed _pendingBatch variable declaration order causing JS error
- Archive data not displaying and Generate failing were both caused by this error

### Performance
- Font preconnect added for Google Fonts (faster font load, less flicker)

### Security
- vercel.json updated with CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy headers

---

## [1.7] 2026-03-03 - Accessibility, UX & Dark Mode

### Keyboard & Focus
- Modal open: focus moves to close/action button automatically
- Modal close: focus returns to the card that was clicked
- Escape key closes all modals (detail, summary, auth)

### Search
- Matched keywords highlighted in card title and content
- Highlight color adapts to each theme (warm yellow / blue / green / amber)

### Error Handling
- All errors now use top-of-screen toast instead of inline text
- Toast slides in from top, auto-dismisses after 5s
- Dark background, white text, red left border for clear visibility

### Generate Button
- Disabled state now shows 50% opacity + not-allowed cursor
- More visually obvious when generation is in progress

### Ocean Dark Mode
- Background deepened, text softened for less eye strain
- Card backgrounds brightened for better layer contrast
- Image brightness reduced to 88%
- Card content line-height increased to 1.85 (1.9 on mobile)
- Mood chip touch target increased to 44px on mobile
- Auto-switches to Ocean when system is in dark mode
- Reverts to Linen when system switches back to light mode

### Amber Readability
- Card background changed from near-white to warm beige (#f5e8d0)
- Card text softened from near-black to warm brown (#3a2010)
- Card content line-height increased to 1.85

### Default Theme
- New users land on Linen (white) by default
- Returning users keep their saved theme

### CSS Architecture
- Shared tokens (--radius, --space-*, --transition-*) moved to :root
- Search highlight styles added per theme
- prefers-reduced-motion: all animations disabled for sensitive users
- Print styles: hides UI chrome, shows clean card content only
- Font fallback stack improved for cross-platform coverage
- Olive and Ocean --tertiary contrast improved toward WCAG AA

---

## [1.6] 2026-03-03 - UX Polish & Bug Fixes

### Visual
- Ocean save-as-image modal: selected state border-only, muted Save button
- Amber fun bits: improved contrast with semi-transparent overlay, text changed to cream white
- Knowledge Diet bubbles: theme-aware colors (Amber warm pastels, Olive bright palette)
- Loading animation: reverted to original "Collecting wonders" line animation

### Bug Fixes
- Olive and Ocean password input and Generate button restored to light colors on mobile

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
