import { describe, expect, it } from 'vitest'
import { createInitialSection, type PavementLayer, type StationRange } from './models'
import { calculateQuantityProvenance } from './quantity'

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

    // Default paved width = 2 × (3.5 + 3.5 + 2.5) = 19.0 m.
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

    // left 9.5 m + right 4.75 m = 14.25 m; × 100 m = 1,425 m².
    expect(result.quantity).toBeCloseTo(1425, 8)
  })
})
