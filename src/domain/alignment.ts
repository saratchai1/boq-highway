import type {
  CrossSectionModel,
  StationRange,
  SuperelevationTransition,
  WideningTransition,
} from './models'

export type TransitionFinding = {
  id: string
  type: 'invalid' | 'overlap'
  message: string
}

export type TransitionValidation = {
  status: 'ok' | 'warning' | 'invalid'
  findings: TransitionFinding[]
}

const inRange = (station: number, start: number, end: number) => station >= start && station <= end

const interpolate = (station: number, start: number, end: number, from: number, to: number) => {
  if (end <= start) return to
  const t = Math.min(1, Math.max(0, (station - start) / (end - start)))
  return from + (to - from) * t
}

export function validateTransitionRanges<T extends { id: string; start: number; end: number }>(items: T[]): TransitionValidation {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end)
  const findings: TransitionFinding[] = []

  for (const item of sorted) {
    if (!Number.isFinite(item.start) || !Number.isFinite(item.end) || item.end <= item.start) {
      findings.push({ id: `invalid-${item.id}`, type: 'invalid', message: `${item.id}: STA ปลายต้องมากกว่า STA ต้น` })
    }
  }

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]
    const current = sorted[index]
    if (previous.end > current.start) {
      findings.push({
        id: `overlap-${previous.id}-${current.id}`,
        type: 'overlap',
        message: `${previous.id} ซ้อนกับ ${current.id}`,
      })
    }
  }

  return {
    status: findings.some((finding) => finding.type === 'invalid') ? 'invalid' : findings.length ? 'warning' : 'ok',
    findings,
  }
}

export function resolveSectionAtStation(
  station: number,
  assignments: StationRange[],
  sections: CrossSectionModel[],
): CrossSectionModel | null {
  const assignment = assignments.find((range) => station >= range.start && station <= range.end)
  if (!assignment) return null
  return sections.find((section) => section.id === assignment.sectionId) ?? null
}

export function wideningAtStation(station: number, transitions: WideningTransition[]) {
  let left = 0
  let right = 0

  for (const transition of transitions) {
    if (!inRange(station, transition.start, transition.end)) continue
    const value = interpolate(station, transition.start, transition.end, transition.from, transition.to)
    if (transition.side === 'left' || transition.side === 'both') left += value
    if (transition.side === 'right' || transition.side === 'both') right += value
  }

  return { left, right }
}

export function superelevationAtStation(
  station: number,
  transitions: SuperelevationTransition[],
  fallback: { left: number; right: number },
) {
  const active = transitions.find((transition) => inRange(station, transition.start, transition.end))
  if (!active) return { ...fallback, transitionId: null as string | null, pivot: null as SuperelevationTransition['pivot'] | null }

  return {
    left: interpolate(station, active.start, active.end, active.leftFrom, active.leftTo),
    right: interpolate(station, active.start, active.end, active.rightFrom, active.rightTo),
    transitionId: active.id,
    pivot: active.pivot,
  }
}

export function deriveSectionAtStation(
  station: number,
  assignments: StationRange[],
  sections: CrossSectionModel[],
  widening: WideningTransition[],
  superelevation: SuperelevationTransition[],
): CrossSectionModel | null {
  const base = resolveSectionAtStation(station, assignments, sections)
  if (!base) return null

  const wideningValue = wideningAtStation(station, widening)
  const slope = superelevationAtStation(station, superelevation, {
    left: base.left.crossSlope,
    right: base.right.crossSlope,
  })

  return {
    ...base,
    left: {
      ...base.left,
      outsideShoulder: base.left.outsideShoulder + wideningValue.left,
      crossSlope: slope.left,
    },
    right: {
      ...base.right,
      outsideShoulder: base.right.outsideShoulder + wideningValue.right,
      crossSlope: slope.right,
    },
  }
}

export function collectTransitionBreakpoints(
  start: number,
  end: number,
  widening: WideningTransition[],
): number[] {
  const points = new Set<number>([start, end])
  for (const transition of widening) {
    if (transition.end <= start || transition.start >= end) continue
    points.add(Math.max(start, transition.start))
    points.add(Math.min(end, transition.end))
  }
  return [...points].sort((a, b) => a - b)
}
