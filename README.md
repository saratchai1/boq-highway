# BOQ Highway

Prototype web application for highway quantity takeoff and typical cross-section configuration.

## Current MVP

- Highway BOQ dashboard inspired by the supplied reference screens
- Typical Cross Section editor with lane widths, median, shoulders, ROW and side slope
- DOH standard drawing references and concrete barrier settings
- Superelevation policy fields
- Live SVG cross-section preview
- Editable STA ranges
- Derived pavement quantities for the configured station length
- Responsive desktop modal workflow matching the reference layout closely

## Run locally

```bash
npm install
npm run dev
```

## Validate

```bash
npm run typecheck
npm run build
```

The current quantity engine is an MVP. Before production estimating, project-specific DOH calculation rules, widening transitions, superelevation transitions, cut/fill and payment-item rules should be validated against authoritative standards and sample outputs.
