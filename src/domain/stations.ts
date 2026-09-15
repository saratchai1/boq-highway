import type { StationRange } from './models'

export type CoverageFinding = {
  id: string
  type: 'gap' | 'overlap' | 'invalid'
  start: number
  end: number
  rangeIds: string[]
  message: string
}

export type CoverageAnalysis = {
  status: 'complete' | 'warning' | 'invalid' | 'empty'
  spanStart: number | null
  spanEnd: number | null
  spanLength: number
  coveredLength: number
  findings: CoverageFinding[]
  sortedRanges: StationRange[]
}

export const formatStation = (value: number) => {
  const sign = value < 0 ? '-' : ''
  const absolute = Math.abs(value)
  const km = Math.floor(absolute / 1000)
  const m = absolute % 1000
  return `${sign}${km}+${String(m.toFixed(3)).padStart(7, '0')}`
}

export function analyzeStationCoverage(ranges: StationRange[]): CoverageAnalysis {
  if (ranges.length === 0) {
    return {
      status: 'empty',
      spanStart: null,
      spanEnd: null,
      spanLength: 0,
      coveredLength: 0,
      findings: [],
      sortedRanges: [],
    }
  }

  const sortedRanges = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end)
  const findings: CoverageFinding[] = []
  const validRanges = sortedRanges.filter((range) => {
    const valid = Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start
    if (!valid) {
      findings.push({
        id: `invalid-${range.id}`,
        type: 'invalid',
        start: range.start,
        end: range.end,
        rangeIds: [range.id],
        message: `ช่วง ${range.id} ไม่ถูกต้อง: STA ปลายต้องมากกว่า STA ต้น`,
      })
    }
    return valid
  })

  if (validRanges.length === 0) {
    return {
      status: 'invalid',
      spanStart: null,
      spanEnd: null,
      spanLength: 0,
      coveredLength: 0,
      findings,
      sortedRanges,
    }
  }

  const spanStart = validRanges[0].start
  const spanEnd = Math.max(...validRanges.map((range) => range.end))
  let cursorEnd = validRanges[0].end
  let cursorRangeIds = [validRanges[0].id]
  let coveredLength = validRanges[0].end - validRanges[0].start

  for (const range of validRanges.slice(1)) {
    if (range.start > cursorEnd) {
      findings.push({
        id: `gap-${cursorEnd}-${range.start}`,
        type: 'gap',
        start: cursorEnd,
        end: range.start,
        rangeIds: [],
        message: `มีช่วงว่าง ${formatStation(cursorEnd)} – ${formatStation(range.start)}`,
      })
      coveredLength += range.end - range.start
      cursorEnd = range.end
      cursorRangeIds = [range.id]
      continue
    }

    if (range.start < cursorEnd) {
      const overlapEnd = Math.min(cursorEnd, range.end)
      findings.push({
        id: `overlap-${range.start}-${overlapEnd}-${range.id}`,
        type: 'overlap',
        start: range.start,
        end: overlapEnd,
        rangeIds: [...cursorRangeIds, range.id],
        message: `ช่วง STA ซ้อนกัน ${formatStation(range.start)} – ${formatStation(overlapEnd)}`,
      })
    }

    if (range.end > cursorEnd) {
      coveredLength += range.end - Math.max(range.start, cursorEnd)
      cursorEnd = range.end
      cursorRangeIds = [range.id]
    } else {
      cursorRangeIds.push(range.id)
    }
  }

  const hasInvalid = findings.some((finding) => finding.type === 'invalid')
  const hasWarning = findings.some((finding) => finding.type === 'gap' || finding.type === 'overlap')

  return {
    status: hasInvalid ? 'invalid' : hasWarning ? 'warning' : 'complete',
    spanStart,
    spanEnd,
    spanLength: spanEnd - spanStart,
    coveredLength,
    findings,
    sortedRanges,
  }
}
