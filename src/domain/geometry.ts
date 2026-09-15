import type { CrossSectionModel, RoadSide, SideKey } from './models'

export type SectionSegment = {
  id: string
  side: SideKey
  kind: 'inside-shoulder' | 'lane' | 'outside-shoulder'
  width: number
  start: number
  end: number
  laneIndex?: number
}

export type SectionGeometry = {
  medianStart: number
  medianEnd: number
  leftEdge: number
  rightEdge: number
  totalWidth: number
  pavedWidth: number
  segments: SectionSegment[]
}

const sidePavedWidth = (side: RoadSide) =>
  side.insideShoulder + side.lanes.reduce((sum, width) => sum + Math.max(0, width), 0) + side.outsideShoulder

function buildSideSegments(sideKey: SideKey, side: RoadSide, medianEdge: number): SectionSegment[] {
  const direction = sideKey === 'right' ? 1 : -1
  const segments: SectionSegment[] = []
  let cursor = medianEdge

  const add = (kind: SectionSegment['kind'], width: number, laneIndex?: number) => {
    const safeWidth = Math.max(0, width)
    const next = cursor + direction * safeWidth
    segments.push({
      id: `${sideKey}-${kind}-${laneIndex ?? 0}`,
      side: sideKey,
      kind,
      width: safeWidth,
      start: Math.min(cursor, next),
      end: Math.max(cursor, next),
      laneIndex,
    })
    cursor = next
  }

  add('inside-shoulder', side.insideShoulder)
  side.lanes.forEach((lane, index) => add('lane', lane, index))
  add('outside-shoulder', side.outsideShoulder)

  return segments
}

export function deriveSectionGeometry(section: CrossSectionModel): SectionGeometry {
  const medianHalf = Math.max(0, section.median) / 2
  const leftSegments = buildSideSegments('left', section.left, -medianHalf)
  const rightSegments = buildSideSegments('right', section.right, medianHalf)
  const leftWidth = sidePavedWidth(section.left)
  const rightWidth = sidePavedWidth(section.right)

  return {
    medianStart: -medianHalf,
    medianEnd: medianHalf,
    leftEdge: -medianHalf - leftWidth,
    rightEdge: medianHalf + rightWidth,
    totalWidth: leftWidth + Math.max(0, section.median) + rightWidth,
    pavedWidth: leftWidth + rightWidth,
    segments: [...leftSegments, ...rightSegments],
  }
}

export function mirrorLeftToRight(section: CrossSectionModel): CrossSectionModel {
  return {
    ...section,
    right: {
      lanes: [...section.left.lanes],
      insideShoulder: section.left.insideShoulder,
      outsideShoulder: section.left.outsideShoulder,
      crossSlope: section.left.crossSlope,
      sideSlope: section.left.sideSlope,
    },
  }
}
