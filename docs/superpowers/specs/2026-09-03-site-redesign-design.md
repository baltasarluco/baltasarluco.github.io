# Site redesign — "long exposure" (2026-09-03)

## Brief
Same content, same sections, same behaviour (SPA section fades, tools dropdown,
contact form, photo collage + lightbox, brick-breaker brand easter egg).
Goal: a more modern, minimalist look whose astrophysics identity comes from the
star-trail photograph already used as the page background.

## Decisions
- **Stack stays vanilla HTML/CSS/JS.** shadcn/ui, shadcnblocks and the TypeScript
  LSP target React + Tailwind projects; migrating a static GitHub Pages site to
  a build pipeline is out of scope and would change how the site deploys.
- **Dark-first, light supported.** The night-sky photo is the thesis, so dark is
  the primary theme. Light theme remains; a header toggle persists the choice
  and the OS preference is honoured on first visit.
- **Palette from the photo** (star trails over an observatory dome):
  - sky `#0a1118` (page), trail ice-blue `#8fd6ea` (single accent),
    dome amber `#dcb77c` (used once: highlights "Luco, Baltasar" in author lists),
    ink `#e9eef2`, muted `#8fa0ad`, glass panels `rgba(16,26,36,.66)`.
  - light: paper `#f2f5f7`, ink `#0f1a22`, accent `#0f7d9a`, amber `#8a6420`.
- **Type**: Bricolage Grotesque (display, headings), Instrument Sans (body),
  IBM Plex Mono (utility: dates, bibcodes, tags, counts). Replaces Bebas Neue.
- **Signature**: the hero portrait is cropped to a circle (echoing the mirror cell
  behind him) and sits at the pole of concentric dashed arcs, a drawn star trail,
  rotating one turn every six minutes. Disabled under reduced motion.
- **Structure encodes information**: mono dates on experience roles and
  publications (real sequences), live counts in section headers ("3 papers"),
  no decorative numbering.
- **Panels** are frosted glass over the fixed photo (backdrop blur), 16px radius,
  hairline borders. Cards remain, but fewer nested boxes and more whitespace.

## Small content fixes (not new content)
- "Fluorscence" → "Fluorescence"; stray duplicated CATA line removed.
- Publication abstracts get a "Show full abstract" toggle instead of a silent
  ellipsis.
- Footer "last update" bumped to September 2026.
- Unused preloads (Cooming_zoom, JPG duplicate) dropped.

## Files
- `index.html` rewritten (content preserved, inline styles moved to classes).
- `assets/css/styles.css` rewritten; `styles.min.css` rebuilt with esbuild.
- `assets/js/app.js`: theme toggle, abstract toggle, counts; dead 3I sizing
  hack removed. `app.min.js` rebuilt.
