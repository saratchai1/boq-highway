import type { QuantityProvenance } from './quantity'

export type RateItem = {
  layerId: string
  code: string
  description: string
  unit: 'm²' | 'm³'
  unitRate: number
}

export type EstimateSettings = {
  factorF: number
  vatPercent: number
  contingencyPercent: number
}

export type CostLine = RateItem & {
  quantity: number
  directCost: number
}

export type CostEstimate = {
  lines: CostLine[]
  directSubtotal: number
  contingency: number
  subtotalBeforeFactorF: number
  factorF: number
  factoredSubtotal: number
  vat: number
  grandTotal: number
}

export const DEFAULT_RATES: RateItem[] = [
  { layerId: 'ac-wearing', code: 'HW-AC-01', description: 'AC Wearing Course', unit: 'm²', unitRate: 420 },
  { layerId: 'ac-binder', code: 'HW-AC-02', description: 'AC Binder / Leveling', unit: 'm³', unitRate: 3200 },
  { layerId: 'ac-base', code: 'HW-AC-03', description: 'AC Base', unit: 'm³', unitRate: 2950 },
  { layerId: 'ctb-upper', code: 'HW-BASE-01', description: 'Cement treated / reclaimed base upper', unit: 'm³', unitRate: 850 },
  { layerId: 'ctb-lower', code: 'HW-BASE-02', description: 'Cement treated / reclaimed base lower', unit: 'm³', unitRate: 780 },
  { layerId: 'subbase', code: 'HW-SB-01', description: 'Subbase', unit: 'm³', unitRate: 620 },
  { layerId: 'selected-a', code: 'HW-SEL-01', description: 'Selected material A', unit: 'm³', unitRate: 480 },
]

export const DEFAULT_ESTIMATE_SETTINGS: EstimateSettings = {
  factorF: 1.499,
  vatPercent: 7,
  contingencyPercent: 0,
}

export function calculateCostEstimate(
  quantities: QuantityProvenance[],
  rates: RateItem[],
  settings: EstimateSettings,
): CostEstimate {
  const lines = rates.map((rate) => {
    const source = quantities.find((item) => item.layerId === rate.layerId)
    const quantity = source?.quantity ?? 0
    return { ...rate, quantity, directCost: quantity * Math.max(0, rate.unitRate) }
  })

  const directSubtotal = lines.reduce((sum, line) => sum + line.directCost, 0)
  const contingency = directSubtotal * Math.max(0, settings.contingencyPercent) / 100
  const subtotalBeforeFactorF = directSubtotal + contingency
  const factorF = Math.max(0, settings.factorF)
  const factoredSubtotal = subtotalBeforeFactorF * factorF
  const vat = factoredSubtotal * Math.max(0, settings.vatPercent) / 100
  const grandTotal = factoredSubtotal + vat

  return {
    lines,
    directSubtotal,
    contingency,
    subtotalBeforeFactorF,
    factorF,
    factoredSubtotal,
    vat,
    grandTotal,
  }
}

export function estimateToCsv(estimate: CostEstimate): string {
  const rows = [
    ['Code', 'Description', 'Quantity', 'Unit', 'Unit Rate', 'Direct Cost'],
    ...estimate.lines.map((line) => [
      line.code,
      line.description,
      line.quantity.toFixed(3),
      line.unit,
      line.unitRate.toFixed(2),
      line.directCost.toFixed(2),
    ]),
    ['', 'Direct subtotal', '', '', '', estimate.directSubtotal.toFixed(2)],
    ['', 'Contingency', '', '', '', estimate.contingency.toFixed(2)],
    ['', `Factor F (${estimate.factorF.toFixed(3)})`, '', '', '', estimate.factoredSubtotal.toFixed(2)],
    ['', 'VAT', '', '', '', estimate.vat.toFixed(2)],
    ['', 'Grand total', '', '', '', estimate.grandTotal.toFixed(2)],
  ]

  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
}
