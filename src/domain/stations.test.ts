import { describe, expect, it } from 'vitest'
import type { StationRange } from './models'
import { analyzeStationCoverage } from './stations'

const range = (id: string, start: number, end: number): StationRange => ({ id, start, end, sectionId: 'tcs-2' })

describe('analyzeStationCoverage', () => {
  it('marks touching ranges as complete', () => {
    const result = analyzeStationCoverage([
      range('a', 1000, 2000),
      range('b', 2000, 3000),
    ])

    expect(result.status).toBe('complete')
    expect(result.findings).toHaveLength(0)
    expect(result.coveredLength).toBe(2000)
  })

  it('detects a gap and does not claim continuity', () => {
    const result = analyzeStationCoverage([
      range('a', 31800, 35100),
      range('b', 35600, 38750),
    ])

    expect(result.status).toBe('warning')
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'gap', start: 35100, end: 35600 }),
    ]))
    expect(result.coveredLength).toBe(6450)
    expect(result.spanLength).toBe(6950)
  })

  it('detects overlaps without double-counting covered length', () => {
    const result = analyzeStationCoverage([
      range('a', 1000, 2500),
      range('b', 2000, 3000),
    ])

    expect(result.status).toBe('warning')
    expect(result.findings[0]).toEqual(expect.objectContaining({ type: 'overlap', start: 2000, end: 2500 }))
    expect(result.coveredLength).toBe(2000)
  })

  it('rejects reversed station ranges', () => {
    const result = analyzeStationCoverage([range('bad', 2000, 1000)])

    expect(result.status).toBe('invalid')
    expect(result.findings[0].type).toBe('invalid')
  })
})
