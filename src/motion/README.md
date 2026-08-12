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

## Stack

- UI motion: existing `motion` package
- Complex hero: SVG state machine (or Rive)
- Micro: CSS (`cta-arrow`, category hover)
- Respects `prefers-reduced-motion`
