# Changelog — knowing。

---

## [2.0] 2026-03-04 — Rebrand & Feature Expansion

### Brand
- Product renamed from **Curiosity Box** to **knowing。** (Chinese period signature)
- Typewriter animation on hero: types out brand name with multi-phase reveal
- Gradient `knowing。` signature used throughout: share images, PDF export, empty state
- OG image updated: "Five things worth knowing。" large serif layout, 1200×630px

### Export
- **Export archive** now generates both JSON backup and a designed PDF simultaneously
- PDF cover: large gradient `knowing。` in DM Serif Display italic, stats block (wonders / sessions / starred), knowledge diet bar chart
- PDF content pages: category color accent bar, title, body, insight, source per item; starred items marked ★
- PDF header rule + footer: `knowing。` left-aligned, page number right-aligned
- JSON export unchanged; import merges without duplicates

### Generate Button
- Hover: button background becomes flowing rainbow gradient (1.5s loop)
- Idle: subtle rainbow glow pulse retained

### Empty State
- Removed decorative circle icon; empty state starts directly with "Nothing here yet."

### Easter Egg
- Planet egg toast updated to English: "You weren't supposed to find this. Fine! Wanna play a game?"
- "game?" is inline hyperlink to Flappy Bird
- `showPlanetEgg()` and `hidePlanetEgg()` functions added (were previously missing)

### Password Input
- Switched to `type="password"` (shows ****) with `autocomplete="off"`, random `name` attribute, and `readonly` + `onfocus` trick to block browser autofill suggestions

### Mobile Fixes
- Save image modal: removed sticky background color block behind Save/Close buttons
- All modals (save image, detail, summary, share, wonder overlay, Flappy Bird): body scroll locks on open and unlocks on close — prevents touch events bleeding through to background page
- All modals: added `-webkit-overflow-scrolling: touch` and `overscroll-behavior: contain` for smooth iOS internal scrolling
- Top nav date font size reduced to 9px on mobile to match Archive label

### Share Image
- Watermark: "The Little Bird" removed; `knowing。` moved to right-aligned only

### OG Image
- `og-image.png` cropped to 1200×630 with linen background padding (no text clipped)

---

## [1.9] 2026-03-04 — UI Polish & Image Styles

### Rainbow Animations
- "Made with curiosity" footer text animates with flowing rainbow gradient (8s loop)
- Top nav bar and footer divider display static rainbow gradient via `--grad`
- Generate button has rainbow glow pulse animation; stops when disabled
- `--grad` (knowing. section) and `--grad-footer` (footer text) are independent per theme

### Tag Visibility
- Active and hover tags now show `color: #fff` with text-shadow on all themes
- Amber active tag uses dark brown background for contrast on warm background
- Ocean and Olive themes: `font-weight: 500` on active/hover tags
- Search highlight inside tags no longer occludes text

### Auth UI
- Email input replaced with **avatar circle** (first letter of email, 32px, theme-colored)
- Clicking avatar opens dropdown with email address and Sign Out button
- Click-outside closes the dropdown automatically

### Save as Image — Styles
- **Dark** style replaced with **Neon**: dark bg, cyan/magenta glow, Orbitron font, grid lines
- **Headline** style replaced with **Minimal**: large centered italic quote, accent line, title below
- Category label hidden in Neon, Parchment, Minimal, Light, Ink, Gradient styles
- Neon source text: white with cyan glow for high contrast
- Ink insight and source text brightness increased for legibility on dark background
- Minimal: two-pass rendering for true vertical centering; quote font enlarged to `0.050W`
- English body and insight text rendered with **justify** alignment across all styles

### Other Polish
- Static "SHARE" label removed from share bar
- Image picker hover uses `--surface` for theme-aware background
- "Wonder again" hover adds `letter-spacing: 3px`
- Share button hover improved for Amber and Ocean card themes

---

## [1.8] 2026-03-03 — Bug Fixes & Performance

### Bug Fixes
- Fixed `_pendingBatch` variable declaration order causing JS error on load
- Archive data not displaying and Generate failing were both caused by this error

### Performance
- Font preconnect added for Google Fonts (faster font load, less flicker)

### Security
- `vercel.json` updated with CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy headers

---

## [1.7] 2026-03-03 — Accessibility, UX & Dark Mode

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
- Disabled state shows 50% opacity + `not-allowed` cursor
- More visually obvious when generation is in progress

### Ocean Dark Mode
- Background deepened, text softened for less eye strain
- Card backgrounds brightened for better layer contrast
- Image brightness reduced to 88%
- Card content `line-height` increased to 1.85 (1.9 on mobile)
- Mood chip touch target increased to 44px on mobile
- Auto-switches to Ocean when system is in dark mode; reverts to Linen on light mode

### Amber Readability
- Card background changed from near-white to warm beige (`#f5e8d0`)
- Card text softened from near-black to warm brown (`#3a2010`)
- Card content `line-height` increased to 1.85

### Default Theme
- New users land on Linen (white) by default
- Returning users keep their saved theme

### CSS Architecture
- Shared tokens (`--radius`, `--space-*`, `--transition-*`) moved to `:root`
- Search highlight styles added per theme
- `prefers-reduced-motion`: all animations disabled for sensitive users
- Print styles: hides UI chrome, shows clean card content only
- Font fallback stack improved for cross-platform coverage
- Olive and Ocean `--tertiary` contrast improved toward WCAG AA

---

## [1.6] 2026-03-03 — UX Polish & Bug Fixes

### Visual
- Ocean save-as-image modal: selected state border-only, muted Save button
- Amber fun bits: improved contrast with semi-transparent overlay, text changed to cream white
- Knowledge Diet bubbles: theme-aware colors (Amber warm pastels, Olive bright palette)
- Loading animation: reverted to original "Collecting wonders" line animation

### Bug Fixes
- Olive and Ocean password input and Generate button restored to light colors on mobile

---

## [1.5] 2026-03-03 — Security, Stability & Maintainability

### Security
- API requests time out after 30s via `AbortController`
- Password input limited to 64 characters
- `autocomplete=current-password` added

### Stability
- Offline/online toast notifications
- `localStorage` writes wrapped in try/catch
- Empty catch blocks now log `console.error`
- Abort errors handled with distinct message

### Maintainability
- JS constants at top of script: `MAX_BATCHES`, `API_TIMEOUT_MS`, `MAX_PW_LENGTH`
- CSS has 12 labeled section comments
- Spacing scale variables: `--space-xs` through `--space-xl`

---

## [1.4] 2026-03-03 — UX Improvements

### Error Handling
- Warning icon added to error messages via CSS
- Network errors use toast; `showToast()` helper added

### Empty States
- Archive empty: icon + call to action
- Search no results: friendly message
- Starred empty: helpful hint

### Accessibility
- `focus-visible` keyboard styles
- `aria-label` on Generate, Settings, filter buttons
- `aria-live` on loading area
- `role=status` on empty states
- `lang=en` on html tag

---

## [1.3] 2026-03-03 — Visual Design System

### Spacing
- All padding/margin/gap on 8px grid

### Typography
- 4 clear levels: titles / 16px body / 13px supporting / 11px labels
- Removed intermediate sizes like 9px, 12.5px

### Colors
- `--accent` and `--accent-text` added to all themes
- Linen: all hardcoded colors replaced with CSS variables

---

## [1.2] 2026-03-03 — Mobile Optimization

- Sticky archive toolbar
- Password input flexible width
- Touch targets minimum 44×44px
- Theme dots 24px
- Date hidden on mobile nav
- 16px body text (prevents iOS zoom)
- Mood chips wrap on small screens

---

## [1.1] 2026-03-03 — Theme and UI Polish

- Date format: `TODAY IS WEEKDAY, DATE`
- Olive: card/button color `#d8e8c8`
- Amber: fun bits contrast improved, warm pastel bubbles
- Ocean: save modal border-only selection, muted save button
- Knowledge Diet bubbles theme-aware colors

---

## [1.0] 2026-03-02 — Initial Build

- 5-theme system: Linen, Amber, Olive, Ocean
- Anthropic API generation with password
- Archive: search, filter, star, date groups
- EN/Chinese toggle per card
- Save as image: 6 styles × 3 ratios
- Sidebar: bubbles, picks, reading links
- Fun bits section
- Supabase auth
- Flappy Bird easter egg
