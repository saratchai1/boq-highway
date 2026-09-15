import { describe, expect, it } from 'vitest'
import {
  deriveSectionAtStation,
  resolveSectionAtStation,
  superelevationAtStation,
  validateTransitionRanges,
  wideningAtStation,
} from './alignment'
import { createInitialRanges, createInitialSections, type SuperelevationTransition, type WideningTransition } from './models'

describe('alignment transition engine', () => {
  it('resolves the assigned TCS by station', () => {
    const sections = createInitialSections()
    const assignments = createInitialRanges()
    expect(resolveSectionAtStation(32000, assignments, sections)?.id).toBe('tcs-1')
    expect(resolveSectionAtStation(36000, assignments, sections)?.id).toBe('tcs-2')
    expect(resolveSectionAtStation(40000, assignments, sections)?.id).toBe('tcs-3')
  })

  it('interpolates widening linearly', () => {
    const widening: WideningTransition[] = [
      { id: 'w', start: 100, end: 200, side: 'both', from: 0, to: 1 },
    ]
    expect(wideningAtStation(150, widening)).toEqual({ left: 0.5, right: 0.5 })
  })

  it('interpolates left/right superelevation independently', () => {
    const transitions: SuperelevationTransition[] = [
      { id: 'se', start: 100, end: 200, leftFrom: 2.5, leftTo: -5, rightFrom: 2.5, rightTo: 5, pivot: 'split-pg' },
    ]
    const result = superelevationAtStation(150, transitions, { left: 2.5, right: 2.5 })
    expect(result.left).toBeCloseTo(-1.25, 8)
    expect(result.right).toBeCloseTo(3.75, 8)
    expect(result.transitionId).toBe('se')
  })

  it('applies widening and slope to the station-specific section', () => {
    const sections = createInitialSections()
    const assignments = createInitialRanges()
    const section = deriveSectionAtStation(
      34800,
      assignments,
      sections,
      [{ id: 'w', start: 34400, end: 35200, side: 'right', from: 0, to: 0.8 }],
      [{ id: 'se', start: 34600, end: 35000, leftFrom: 2.5, leftTo: -4, rightFrom: 2.5, rightTo: 4, pivot: 'split-pg' }],
    )
    expect(section).not.toBeNull()
    expect(section!.right.outsideShoulder).toBeCloseTo(2.4, 8)
    expect(section!.left.crossSlope).toBeCloseTo(-0.75, 8)
    expect(section!.right.crossSlope).toBeCloseTo(3.25, 8)
  })

  it('flags overlapping transition ranges', () => {
    const result = validateTransitionRanges([
      { id: 'a', start: 0, end: 100 },
      { id: 'b', start: 90, end: 150 },
    ])
    expect(result.status).toBe('warning')
    expect(result.findings[0].type).toBe('overlap')
  })
})
