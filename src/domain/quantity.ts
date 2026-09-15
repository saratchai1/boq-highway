import { deriveSectionGeometry } from './geometry'
import type { CrossSectionModel, PavementLayer, StationRange } from './models'
import { formatStation } from './stations'

export type QuantityContribution = {
  rangeId: string
  start: number
  end: number
  length: number
  pavedWidth: number
  quantity: number
  label: string
}

export type QuantityProvenance = {
  layerId: string
  name: string
  unit: PavementLayer['unit']
  thickness: number
  quantity: number
  formula: string
  standard?: string
  contributions: QuantityContribution[]
}

export function calculateQuantityProvenance(
  section: CrossSectionModel,
  ranges: StationRange[],
  layers: PavementLayer[],
): QuantityProvenance[] {
  const { pavedWidth } = deriveSectionGeometry(section)
  const validRanges = ranges.filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)

  return layers.map((layer) => {
    const contributions = validRanges.map((range) => {
      const length = range.end - range.start
      const baseArea = pavedWidth * length
      const quantity = layer.unit === 'm²' ? baseArea : baseArea * layer.thickness
      return {
        rangeId: range.id,
        start: range.start,
        end: range.end,
        length,
        pavedWidth,
        quantity,
        label: `${formatStation(range.start)} – ${formatStation(range.end)}`,
      }
    })

    return {
      layerId: layer.id,
      name: layer.name,
      unit: layer.unit,
      thickness: layer.thickness,
      quantity: contributions.reduce((sum, contribution) => sum + contribution.quantity, 0),
      formula: layer.unit === 'm²'
        ? 'Σ (effective paved width × station length)'
        : `Σ (effective paved width × station length × ${layer.thickness.toFixed(3)} m)`,
      standard: layer.standard,
      contributions,
    }
  })
}
