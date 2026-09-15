import { describe, expect, it } from 'vitest'
import { calculateCostEstimate, DEFAULT_ESTIMATE_SETTINGS, type RateItem } from './cost'
import type { QuantityProvenance } from './quantity'

const quantities: QuantityProvenance[] = [
  {
    layerId: 'a', name: 'A', unit: 'm²', thickness: 0, quantity: 100,
    formula: 'x', contributions: [],
  },
  {
    layerId: 'b', name: 'B', unit: 'm³', thickness: 0.1, quantity: 10,
    formula: 'x', contributions: [],
  },
]

const rates: RateItem[] = [
  { layerId: 'a', code: 'A', description: 'A', unit: 'm²', unitRate: 5 },
  { layerId: 'b', code: 'B', description: 'B', unit: 'm³', unitRate: 20 },
]

describe('calculateCostEstimate', () => {
  it('calculates direct cost, factor F and VAT', () => {
    const estimate = calculateCostEstimate(quantities, rates, { ...DEFAULT_ESTIMATE_SETTINGS, factorF: 1.5, vatPercent: 7 })
    expect(estimate.directSubtotal).toBe(700)
    expect(estimate.factoredSubtotal).toBe(1050)
    expect(estimate.vat).toBeCloseTo(73.5, 8)
    expect(estimate.grandTotal).toBeCloseTo(1123.5, 8)
  })

  it('allows contingency before factor F', () => {
    const estimate = calculateCostEstimate(quantities, rates, { factorF: 1, vatPercent: 0, contingencyPercent: 10 })
    expect(estimate.contingency).toBe(70)
    expect(estimate.grandTotal).toBe(770)
  })
})
