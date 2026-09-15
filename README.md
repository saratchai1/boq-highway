# boq-highway

Model-driven highway BOQ engineering MVP based on the supplied reference workflow.

## Architecture

The app separates engineering rules from the React UI:

- `src/domain/models.ts` — cross-sections, TCS assignments, pavement layers, widening and superelevation schedules
- `src/domain/geometry.ts` — derives left/right section geometry from parametric components
- `src/domain/stations.ts` — detects STA gaps, overlaps and invalid assignments
- `src/domain/alignment.ts` — resolves TCS by station and interpolates widening / superelevation transitions
- `src/domain/quantity.ts` — integrates quantities across TCS assignments and linear widening with per-range provenance
- `src/domain/*.test.ts` — engineering regression tests
- `src/App.tsx` — engineering workspace and BOQ UI

## Implemented workflow

1. Build a catalog of Typical Cross Sections.
2. Assign each TCS to explicit STA ranges.
3. Validate station coverage before a model is considered ready.
4. Define left/right widening transitions along the alignment.
5. Define independent left/right superelevation transitions and preview them at any station.
6. Generate the station-specific cross section from TCS + widening + superelevation.
7. Calculate pavement quantities across all assigned ranges.
8. Trace every BOQ quantity back to TCS, STA range, average effective width and formula.
9. Compare quantities with/without widening to expose design impact.

The default demo now covers STA 31+500 to 41+150 continuously using three TCS assignments, three widening transitions and three superelevation transitions.

## Validation boundary

This repository is a working engineering MVP, not an authoritative DOH estimating database. Before commercial or contractual use, verify standard drawing revisions, pavement rules, superelevation criteria, widening criteria, unit rates, Factor F and project-specific measurement/payment rules against the governing documents.

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
