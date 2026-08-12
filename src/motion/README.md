# Première Services — Motion

## Hero marketplace animation

Built-in SVG state machine (`MarketplaceMatchAnimation`) drives the hero.

States: `idle` → `hover` → `request` → `searching` → `matching` → `matched` → `success`

Controlled by:
- CTA hover (`idle` ↔ `hover`)
- `ServiceRequestDemo` chip flow

## Optional Rive drop-in

Place a file at:

`public/rive/hero-marketplace.riv`

Requirements:
- State machine name: `Marketplace`
- Number input: `phase` (0–6 mapping to the states above)

`RiveHeroMarketplace` auto-detects the file and lazy-loads `@rive-app/react-canvas`.
If missing, the SVG animation stays active.

## Cursor-follow character (community `.riv`)

A downloaded Rive community file (e.g. “Interactive Character Follow”) is **not source code and not encryption**.
It is a compiled binary asset (`.riv`), similar to a `.png` or `.mp4`.

How to use it:
1. Save the real file from your Downloads folder (do not paste binary into chat) as e.g. `public/rive/character-follow.riv`.
2. Load it with `@rive-app/react-canvas` / `useRive`.
3. Use the state machine name from the file (often `State Machine 1`) and wire mouse X/Y or the inputs exposed in the editor (e.g. head rotation / blink).

That file’s machines (`Blinking`, `Head rotation`, listeners) do **not** match our hero `Marketplace` + `phase` contract — use a separate React component for it.

## Stack

- UI motion: existing `motion` package
- Complex hero: SVG state machine (or Rive)
- Micro: CSS (`cta-arrow`, category hover)
- Respects `prefers-reduced-motion`
