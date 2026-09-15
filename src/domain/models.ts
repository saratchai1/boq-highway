export type SideKey = 'left' | 'right'

export type RoadSide = {
  lanes: number[]
  insideShoulder: number
  outsideShoulder: number
  crossSlope: number
  sideSlope: number
}

export type StandardReference = {
  code: string
  title: string
  revision?: string
}

export type CrossSectionModel = {
  id: string
  name: string
  row: number
  median: number
  sidewalk: number
  raisedMedian: number
  rowOffset: number
  symmetric: boolean
  left: RoadSide
  right: RoadSide
  medianType: string
  structureMode: string
  surfaceMode: string
  barrier: {
    code: string
    label: string
    height: number
    baseWidth: number
  }
  superelevation: {
    source: string
    pivot: string
    shoulderPolicy: string
  }
  standards: StandardReference[]
}

export type StationRange = {
  id: string
  start: number
  end: number
  sectionId: string
}

export type PavementLayer = {
  id: string
  name: string
  thickness: number
  unit: 'm²' | 'm³'
  standard?: string
  color: string
}

export const DEFAULT_LAYERS: PavementLayer[] = [
  { id: 'ac-wearing', name: 'ผิว AC Wearing', thickness: 0.05, unit: 'm²', standard: 'DOH pavement schedule', color: '#222a35' },
  { id: 'ac-binder', name: 'AC Binder / Leveling', thickness: 0.05, unit: 'm³', standard: 'DOH pavement schedule', color: '#667180' },
  { id: 'ac-base', name: 'AC Base', thickness: 0.08, unit: 'm³', standard: 'DOH pavement schedule', color: '#3d4654' },
  { id: 'ctb-upper', name: 'พื้นทางเดิมซีเมนต์ (บด)', thickness: 0.15, unit: 'm³', color: '#f2a400' },
  { id: 'ctb-lower', name: 'พื้นทางเดิมซีเมนต์ (ล่าง)', thickness: 0.15, unit: 'm³', color: '#ed8d00' },
  { id: 'subbase', name: 'รองพื้นทาง Subbase', thickness: 0.15, unit: 'm³', color: '#e2bd74' },
  { id: 'selected-a', name: 'วัสดุคัดเลือก ก', thickness: 0.2, unit: 'm³', color: '#c69a58' },
]

const defaultSide = (): RoadSide => ({
  lanes: [3.5, 3.5],
  insideShoulder: 0,
  outsideShoulder: 2.5,
  crossSlope: 2.5,
  sideSlope: 2,
})

export const createInitialSection = (): CrossSectionModel => ({
  id: 'tcs-2',
  name: 'TCS-2',
  row: 30,
  median: 2.62,
  sidewalk: 0,
  raisedMedian: 0,
  rowOffset: 0,
  symmetric: true,
  left: defaultSide(),
  right: defaultSide(),
  medianType: 'เกาะแบริเออร์ คสล. (GD-106)',
  structureMode: 'ไม่มีเขตทาง — คันทาง + ลาดข้าง',
  surfaceMode: 'ผิวจราจร + ไหล่ทาง (ค่าเดิม)',
  barrier: {
    code: 'RS-608',
    label: 'แบริเออร์ คสล. Type I (หล่อในที่)',
    height: 0.81,
    baseWidth: 0.6,
  },
  superelevation: {
    source: 'Curve Data ตาม Alignment (e / LT-RT / STA)',
    pivot: 'PG.(LT.) / PG.(RT.) แยกอิสระ (ตามแบบ 15–18)',
    shoulderPolicy: 'หมุนตามผิวจราจร',
  },
  standards: [
    { code: 'GD-106', title: 'เรขาคณิตเกาะกลาง' },
    { code: 'DS-402', title: 'รางรับน้ำในเกาะ' },
    { code: 'GD-402', title: 'แบบเกี่ยวข้อง' },
    { code: 'RS-608', title: 'Concrete Barrier Type I' },
  ],
})

export const createInitialRanges = (sectionId = 'tcs-2'): StationRange[] => [
  { id: 'range-1', start: 31800, end: 35100, sectionId },
  { id: 'range-2', start: 35600, end: 38750, sectionId },
]
