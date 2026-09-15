# boq-highway

Model-driven highway BOQ prototype based on the supplied reference workflow.

## What changed from the visual clone

The app is now separated into explicit engineering layers instead of keeping UI state, geometry and quantity formulas inside one React component:

- `src/domain/models.ts` — canonical cross-section, station and pavement models
- `src/domain/geometry.ts` — derives section geometry from left/right components
- `src/domain/stations.ts` — detects STA gaps, overlaps and invalid ranges
- `src/domain/quantity.ts` — calculates quantities with per-range provenance
- `src/domain/*.test.ts` — engineering-rule regression tests
- `src/App.tsx` — UI only orchestrates/edit/displays those models

## Key behavior

- Left/right cross-sections can be symmetric or independently modeled.
- The SVG section is generated from component widths rather than fixed decorative rectangles.
- Station coverage is derived; the UI will not hard-code a “continuous” status.
- Every pavement quantity keeps the STA ranges, effective width, formula and contribution that produced it.
- CI runs typecheck, engineering unit tests and production build.

## Validation boundary

This branch is still an engineering draft. DOH standard dimensions, superelevation transition logic, authoritative pavement rules, unit rates and production estimating rules must be validated against the governing project/DOH documents before quantities are used commercially.

## Run

```bash
npm install
npm run dev
```

## Verify

```bash
npm run typecheck
npm test
npm run build
```
