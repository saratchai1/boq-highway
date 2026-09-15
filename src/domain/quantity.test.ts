import { describe, expect, it } from 'vitest'
import { createInitialSection, type PavementLayer, type StationRange } from './models'
import { calculateProjectQuantityProvenance, calculateQuantityProvenance } from './quantity'

const layer: PavementLayer = {
  id: 'test-layer',
  name: 'Test layer',
  thickness: 0.1,
  unit: 'm³',
  color: '#000',
}

const ranges: StationRange[] = [
  { id: 'r1', start: 1000, end: 2000, sectionId: 'tcs-2' },
  { id: 'r2', start: 2500, end: 3000, sectionId: 'tcs-2' },
]

describe('calculateQuantityProvenance', () => {
  it('keeps a contribution per STA range so every BOQ number is traceable', () => {
    const section = createInitialSection()
    const result = calculateQuantityProvenance(section, ranges, [layer])[0]

    expect(result.contributions).toHaveLength(2)
    expect(result.contributions[0].quantity).toBeCloseTo(1900, 8)
    expect(result.contributions[1].quantity).toBeCloseTo(950, 8)
    expect(result.quantity).toBeCloseTo(2850, 8)
  })

  it('uses independent left/right geometry for asymmetric sections', () => {
    const section = createInitialSection()
    section.symmetric = false
    section.right.lanes = [3.25]
    section.right.outsideShoulder = 1.5

    const result = calculateQuantityProvenance(section, [{ id: 'r', start: 0, end: 100, sectionId: section.id }], [
      { ...layer, unit: 'm²', thickness: 0 },
    ])[0]

    expect(result.quantity).toBeCloseTo(1425, 8)
  })

  it('integrates linear widening with average effective width', () => {
    const section = createInitialSection()
    const result = calculateProjectQuantityProvenance(
      [section],
      [{ id: 'r', start: 0, end: 100, sectionId: section.id }],
      [{ ...layer, unit: 'm²', thickness: 0 }],
      [{ id: 'w', start: 0, end: 100, side: 'both', from: 0, to: 1 }],
    )[0]

    // Base width 19 m. Both sides widen 0 -> 1 m, average total extra width = 1 m.
    // Average paved width 20 m × 100 m = 2,000 m².
    expect(result.quantity).toBeCloseTo(2000, 8)
    expect(result.contributions[0].pavedWidth).toBeCloseTo(20, 8)
  })
})
