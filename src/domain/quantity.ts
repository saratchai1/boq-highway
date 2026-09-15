import { collectTransitionBreakpoints, deriveSectionAtStation } from './alignment'
import { deriveSectionGeometry } from './geometry'
import type {
  CrossSectionModel,
  PavementLayer,
  StationRange,
  SuperelevationTransition,
  WideningTransition,
} from './models'
import { formatStation } from './stations'

export type QuantityContribution = {
  rangeId: string
  sectionId: string
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

const validRange = (range: StationRange) =>
  Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start

export function calculateProjectQuantityProvenance(
  sections: CrossSectionModel[],
  ranges: StationRange[],
  layers: PavementLayer[],
  widening: WideningTransition[] = [],
  superelevation: SuperelevationTransition[] = [],
): QuantityProvenance[] {
  const validRanges = ranges.filter(validRange)

  return layers.map((layer) => {
    const contributions: QuantityContribution[] = []

    for (const range of validRanges) {
      const section = sections.find((candidate) => candidate.id === range.sectionId)
      if (!section) continue

      const breakpoints = collectTransitionBreakpoints(range.start, range.end, widening)
      let quantityForRange = 0
      let weightedWidth = 0
      let totalLength = 0

      for (let index = 0; index < breakpoints.length - 1; index += 1) {
        const start = breakpoints[index]
        const end = breakpoints[index + 1]
        if (end <= start) continue

        const startSection = deriveSectionAtStation(start, [range], [section], widening, superelevation) ?? section
        const endSection = deriveSectionAtStation(end, [range], [section], widening, superelevation) ?? section
        const startWidth = deriveSectionGeometry(startSection).pavedWidth
        const endWidth = deriveSectionGeometry(endSection).pavedWidth
        const averageWidth = (startWidth + endWidth) / 2
        const length = end - start
        const baseArea = averageWidth * length
        const subQuantity = layer.unit === 'm²' ? baseArea : baseArea * layer.thickness

        quantityForRange += subQuantity
        weightedWidth += averageWidth * length
        totalLength += length
      }

      if (totalLength <= 0) continue
      contributions.push({
        rangeId: range.id,
        sectionId: range.sectionId,
        start: range.start,
        end: range.end,
        length: totalLength,
        pavedWidth: weightedWidth / totalLength,
        quantity: quantityForRange,
        label: `${section.name} · ${formatStation(range.start)} – ${formatStation(range.end)}`,
      })
    }

    return {
      layerId: layer.id,
      name: layer.name,
      unit: layer.unit,
      thickness: layer.thickness,
      quantity: contributions.reduce((sum, contribution) => sum + contribution.quantity, 0),
      formula: layer.unit === 'm²'
        ? 'Σ (average effective width incl. widening × station length)'
        : `Σ (average effective width incl. widening × station length × ${layer.thickness.toFixed(3)} m)`,
      standard: layer.standard,
      contributions,
    }
  })
}

export function calculateQuantityProvenance(
  section: CrossSectionModel,
  ranges: StationRange[],
  layers: PavementLayer[],
): QuantityProvenance[] {
  const mapped = ranges.map((range) => ({ ...range, sectionId: section.id }))
  return calculateProjectQuantityProvenance([section], mapped, layers)
}
