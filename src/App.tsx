import { useMemo, useState } from 'react'

type StationRange = { id: number; start: number; end: number }
type Layer = { name: string; thickness: number; unit: 'm²' | 'm³'; color: string }

type CrossSectionState = {
  name: string
  median: number
  insideShoulder: number
  outsideShoulder: number
  sidewalk: number
  raisedMedian: number
  sideSlope: number
  row: number
  rowSlope: number
  lanes: number[]
  medianType: string
  structureMode: string
  surfaceMode: string
  symmetric: boolean
  barrier: string
  barrierHeight: number
  barrierBase: number
  superSource: string
  pivot: string
  slopeDirection: string
  normalCrown: number
}

const initialSection: CrossSectionState = {
  name: 'TCS-2',
  median: 2.62,
  insideShoulder: 0,
  outsideShoulder: 2.5,
  sidewalk: 0,
  raisedMedian: 0,
  sideSlope: 2,
  row: 30,
  rowSlope: 0,
  lanes: [3.5, 3.5],
  medianType: 'เกาะแบริเออร์ คสล. (GD-106)',
  structureMode: 'ไม่มีเขตทาง — คันทาง + ลาดข้าง',
  surfaceMode: 'ผิวจราจร + ไหล่ทาง (ค่าเดิม)',
  symmetric: true,
  barrier: 'RS-608 · แบริเออร์ คสล. Type I (หล่อในที่)',
  barrierHeight: 0.81,
  barrierBase: 0.6,
  superSource: 'Curve Data ตาม Alignment (e / LT-RT / STA)',
  pivot: 'PG.(LT.) / PG.(RT.) แยกอิสระ (ตามแบบ 15–18)',
  slopeDirection: 'หมุนตามผิวจราจร',
  normalCrown: 2.5,
}

const layers: Layer[] = [
  { name: 'ผิว AC Wearing', thickness: 0.05, unit: 'm²', color: '#222a35' },
  { name: 'AC Binder / Leveling', thickness: 0.05, unit: 'm³', color: '#667180' },
  { name: 'AC Base', thickness: 0.08, unit: 'm³', color: '#3d4654' },
  { name: 'พื้นทางเดิมซีเมนต์ (บด)', thickness: 0.15, unit: 'm³', color: '#f2a400' },
  { name: 'พื้นทางเดิมซีเมนต์ (ล่าง)', thickness: 0.15, unit: 'm³', color: '#ed8d00' },
  { name: 'รองพื้นทาง Subbase', thickness: 0.15, unit: 'm³', color: '#e2bd74' },
  { name: 'วัสดุคัดเลือก ก', thickness: 0.2, unit: 'm³', color: '#c69a58' },
]

const formatStation = (value: number) => {
  const km = Math.floor(value / 1000)
  const m = value % 1000
  return `${km}+${String(m.toFixed(3)).padStart(7, '0')}`
}

const Field = ({ label, value, suffix = 'ม.', onChange }: { label: string; value: number; suffix?: string; onChange: (value: number) => void }) => (
  <label className="form-row">
    <span>{label}</span>
    <div className="number-wrap">
      <input type="number" step="0.01" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <small>{suffix}</small>
    </div>
  </label>
)

function CrossSectionGraphic({ section, compact = false }: { section: CrossSectionState; compact?: boolean }) {
  const laneTotal = section.lanes.reduce((sum, lane) => sum + lane, 0)
  const totalRoad = laneTotal * 2 + section.outsideShoulder * 2 + section.insideShoulder * 2 + section.median
  const medianPx = Math.max(36, (section.median / totalRoad) * 820)
  const carriagePx = Math.max(185, ((laneTotal + section.outsideShoulder + section.insideShoulder) / totalRoad) * 820)
  const center = 500
  const leftRoadStart = center - medianPx / 2 - carriagePx
  const rightRoadStart = center + medianPx / 2
  const lanePx = carriagePx * (laneTotal / (laneTotal + section.outsideShoulder + section.insideShoulder || 1))
  const shoulderPx = carriagePx - lanePx

  return (
    <div className={`section-graphic ${compact ? 'compact' : ''}`}>
      <svg viewBox="0 0 1000 320" role="img" aria-label="Typical road cross section preview">
        <defs>
          <pattern id="aggregate" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.4" fill="#b78845" />
            <circle cx="9" cy="7" r="1.1" fill="#d0aa6b" />
          </pattern>
          <pattern id="pavement" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 8L8 0" stroke="#d27e00" strokeWidth="1" />
          </pattern>
        </defs>

        <line x1="92" x2="908" y1="48" y2="48" className="dimension-line" />
        <line x1="92" x2="92" y1="41" y2="56" className="dimension-line" />
        <line x1="908" x2="908" y1="41" y2="56" className="dimension-line" />
        <text x="500" y="39" textAnchor="middle" className="dimension-text">เขต R.O.W. {section.row.toFixed(2)} ม.</text>

        <line x1={leftRoadStart} x2={rightRoadStart + carriagePx} y1="78" y2="78" className="dimension-line" />
        <text x="500" y="69" textAnchor="middle" className="dimension-text">เขตก่อสร้าง {totalRoad.toFixed(2)} ม.</text>

        <polygon points={`${leftRoadStart - 92},224 ${leftRoadStart},174 ${rightRoadStart + carriagePx},174 ${rightRoadStart + carriagePx + 92},224`} fill="#e8c77f" opacity="0.88" />
        <polygon points={`${leftRoadStart},174 ${leftRoadStart + shoulderPx},161 ${center - medianPx / 2},161 ${center - medianPx / 2},190 ${leftRoadStart},190`} fill="url(#pavement)" stroke="#bd7800" />
        <polygon points={`${rightRoadStart},161 ${rightRoadStart + carriagePx - shoulderPx},161 ${rightRoadStart + carriagePx},174 ${rightRoadStart + carriagePx},190 ${rightRoadStart},190`} fill="url(#pavement)" stroke="#bd7800" />
        <rect x={leftRoadStart + shoulderPx} y="151" width={Math.max(0, lanePx - 2)} height="39" fill="#cfd3d6" stroke="#8c959e" />
        <rect x={rightRoadStart} y="151" width={Math.max(0, lanePx - 2)} height="39" fill="#cfd3d6" stroke="#8c959e" />

        {section.lanes.slice(0, -1).map((lane, index) => {
          const before = section.lanes.slice(0, index + 1).reduce((sum, n) => sum + n, 0)
          const ratio = before / laneTotal
          const leftX = leftRoadStart + shoulderPx + lanePx * ratio
          const rightX = rightRoadStart + lanePx * ratio
          return <g key={`${lane}-${index}`}><line x1={leftX} x2={leftX} y1="151" y2="190" stroke="#a7adb3" strokeDasharray="5 4" /><line x1={rightX} x2={rightX} y1="151" y2="190" stroke="#a7adb3" strokeDasharray="5 4" /></g>
        })}

        <rect x={center - medianPx / 2} y="151" width={medianPx} height="39" fill="#e7e2d6" stroke="#9e9686" />
        <path d={`M ${center - 7} 151 L ${center - 5} 115 L ${center + 5} 115 L ${center + 7} 151 Z`} fill="#9da6ad" stroke="#65717b" />
        <line x1={center} x2={center} y1="115" y2="86" stroke="#616a72" strokeWidth="2" />
        <path d={`M ${center - 18} 89 Q ${center} 73 ${center + 18} 89`} fill="none" stroke="#d8ab00" strokeWidth="3" />

        <text x={leftRoadStart + shoulderPx / 2} y="145" textAnchor="middle" className="road-label">งานขยาย</text>
        <text x={leftRoadStart + shoulderPx + lanePx / 2} y="145" textAnchor="middle" className="road-label">ผิวจราจรเดิม</text>
        <text x={rightRoadStart + lanePx / 2} y="145" textAnchor="middle" className="road-label">ผิวจราจรเดิม</text>
        <text x={rightRoadStart + carriagePx - shoulderPx / 2} y="145" textAnchor="middle" className="road-label">งานขยาย</text>
        <text x={center} y="107" textAnchor="middle" className="road-note">เสาไฟ 12.00 ม.</text>
        <text x={center} y="171" textAnchor="middle" className="road-note">RS-608</text>
        <text x="500" y="215" textAnchor="middle" className="ground-label">ระดับดินเดิม (EXISTING GROUND)</text>
        <line x1="80" x2="920" y1="224" y2="224" stroke="#72787e" strokeDasharray="6 5" />
        <text x="108" y="216" className="slope-label">1:{section.sideSlope}</text>
        <text x="876" y="216" className="slope-label">1:{section.sideSlope}</text>
        <text x={leftRoadStart + shoulderPx + lanePx / 2} y="132" textAnchor="middle" className="slope-green">{section.normalCrown.toFixed(1)}%</text>
        <text x={rightRoadStart + lanePx / 2} y="132" textAnchor="middle" className="slope-green">{section.normalCrown.toFixed(1)}%</text>
      </svg>
    </div>
  )
}

function TypicalSectionModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [section, setSection] = useState(initialSection)
  const [ranges, setRanges] = useState<StationRange[]>([
    { id: 1, start: 31800, end: 35100 },
    { id: 2, start: 35600, end: 38750 },
  ])

  const update = <K extends keyof CrossSectionState>(key: K, value: CrossSectionState[K]) => {
    setSection((current) => ({ ...current, [key]: value }))
  }

  const totalLength = ranges.reduce((sum, range) => sum + Math.max(0, range.end - range.start), 0)
  const lanePerDirection = section.lanes.reduce((sum, lane) => sum + lane, 0)
  const pavedWidth = lanePerDirection * 2 + section.outsideShoulder * 2 + section.insideShoulder * 2

  const quantities = useMemo(() => {
    const area = pavedWidth * totalLength
    return layers.map((layer) => ({
      ...layer,
      quantity: layer.unit === 'm²' ? area : area * layer.thickness,
    }))
  }, [pavedWidth, totalLength])

  const setLane = (index: number, value: number) => {
    setSection((current) => ({ ...current, lanes: current.lanes.map((lane, i) => i === index ? value : lane) }))
  }

  return (
    <div className="modal-backdrop">
      <div className={`tcs-modal ${step === 2 ? 'preview-mode' : ''}`}>
        <div className="modal-titlebar">
          <strong>{step === 1 ? 'Typical Cross Section · แม่แบบรูปตัด' : 'แม่แบบรูปตัด'}</strong>
          <span className="section-code">{section.name}</span>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด">×</button>
        </div>

        {step === 1 ? (
          <>
            <div className="name-row">
              <input value={section.name} onChange={(e) => update('name', e.target.value)} />
              <button className="primary-outline" onClick={onClose}>✓ ตกลง</button>
              <button className="ghost-button" onClick={onClose}>× ลบหน้าตัด</button>
            </div>

            <div className="editor-grid">
              <div className="editor-column">
                <section className="panel-box">
                  <h3>DOH Typical Section · แม่แบบมาตรฐาน ทล.</h3>
                  <label className="select-row"><span>แบบ TCS</span><select defaultValue=""><option value="">— เลือกแบบ TCS แล้วใส่ระยะให้อัตโนมัติ —</option><option>TCS-01 ทาง 4 ช่องจราจร</option><option>TCS-02 ทาง 4 ช่องจราจรมีเกาะกลาง</option></select></label>
                </section>

                <section className="panel-box">
                  <h3>Key Dimensions · ระยะหลัก</h3>
                  <Field label="เกาะกลาง" value={section.median} onChange={(v) => update('median', v)} />
                  <Field label="ไหล่ทางใน (ฝั่งเกาะ)" value={section.insideShoulder} onChange={(v) => update('insideShoulder', v)} />
                  <Field label="ไหล่ทางนอก" value={section.outsideShoulder} onChange={(v) => update('outsideShoulder', v)} />
                  <Field label="ทางเท้า" value={section.sidewalk} onChange={(v) => update('sidewalk', v)} />
                  <Field label="ทางเท้ายกสูง (คันหิน)" value={section.raisedMedian} onChange={(v) => update('raisedMedian', v)} />
                  <Field label="ลาดข้าง m:1" value={section.sideSlope} suffix="" onChange={(v) => update('sideSlope', v)} />
                  <Field label="เขต ROW" value={section.row} onChange={(v) => update('row', v)} />
                  <Field label="เยื้อง ⊄ ROW (+ขวา)" value={section.rowSlope} onChange={(v) => update('rowSlope', v)} />
                </section>

                <section className="panel-box">
                  <div className="box-heading-row">
                    <h3>Lane Widths · ช่องจราจร/ทิศ (ในสุด → นอกสุด) · ม.</h3>
                    <div><button className="mini-btn" onClick={() => setSection((c) => ({ ...c, lanes: [...c.lanes, 3.5] }))}>+ เลน</button><button className="mini-btn" disabled={section.lanes.length <= 1} onClick={() => setSection((c) => ({ ...c, lanes: c.lanes.slice(0, -1) }))}>− เลน</button></div>
                  </div>
                  {section.lanes.map((lane, index) => <Field key={index} label={`เลน${index + 1}`} value={lane} onChange={(v) => setLane(index, v)} />)}
                  <div className="lane-total"><span>รวม</span><strong>{lanePerDirection.toFixed(2)} ม./ทิศ ({section.lanes.length} เลน)</strong></div>
                </section>

                <section className="panel-box">
                  <h3>Median & Section Mode · ชนิดเกาะ / โหมดหน้าตัด</h3>
                  <label className="select-row"><span>ชนิดเกาะกลาง</span><select value={section.medianType} onChange={(e) => update('medianType', e.target.value)}><option>เกาะแบริเออร์ คสล. (GD-106)</option><option>เกาะกลางแบบกด</option><option>เกาะกลางแบบยก</option></select></label>
                  <label className="select-row"><span>รูปแบบโครงสร้าง</span><select value={section.structureMode} onChange={(e) => update('structureMode', e.target.value)}><option>ไม่มีเขตทาง — คันทาง + ลาดข้าง</option><option>มีเขตทางเต็มรูปแบบ</option></select></label>
                  <label className="select-row"><span>ปูผิวทางถึงไหน</span><select value={section.surfaceMode} onChange={(e) => update('surfaceMode', e.target.value)}><option>ผิวจราจร + ไหล่ทาง (ค่าเดิม)</option><option>ผิวจราจรเท่านั้น</option></select></label>
                  <label className="select-row"><span>รูปแบบหน้าตัด</span><select value={section.symmetric ? 'sym' : 'asym'} onChange={(e) => update('symmetric', e.target.value === 'sym')}><option value="sym">สมมาตร (ซ้าย = ขวา)</option><option value="asym">ไม่สมมาตร</option></select></label>
                </section>

                <section className="panel-box collapsed"><h3>Widening from Existing Road · ขยายจากถนนเดิม</h3><span>›</span></section>
              </div>

              <div className="editor-column">
                <section className="panel-box">
                  <h3>DOH Standard Drawings · แบบมาตรฐาน ทล. ที่อ้างอิง</h3>
                  <div className="reference-list"><div><span>เรขาคณิตเกาะกลาง</span><b>GD-106</b></div><div><span>รางรับน้ำในเกาะ</span><b>DS-402</b></div><div><span>แบบเกี่ยวข้อง</span><b>GD-402</b></div></div>
                </section>

                <section className="panel-box">
                  <h3>Median Barrier Device · แบบมาตรฐานที่ใช้แยกรายการจ่าย</h3>
                  <label className="select-row full"><span>อ่านจากคอนกรีตในรูปตัด</span><select><option>ERB-401 · ราวกั้นอันตราย 2 หน้า (Double Faced Guard)</option></select></label>
                  <p className="hint">แยกใบปริมาณตามรหัสนี้ → ราวกั้นอันตรายกับแบริเออร์ คสล. จะไม่ถูกรวมเป็นแถวเดียวอีก</p>
                </section>

                <section className="panel-box">
                  <h3>Concrete Barrier · กำแพงคอนกรีตกั้นชน</h3>
                  <label className="select-row"><span>แบบมาตรฐาน</span><select value={section.barrier} onChange={(e) => update('barrier', e.target.value)}><option>RS-608 · แบริเออร์ คสล. Type I (หล่อในที่)</option><option>RS-609 · แบริเออร์สำเร็จรูป</option></select></label>
                  <div className="read-only-row"><span>ทรงหน้าตัด</span><strong>New Jersey · หล่อในที่</strong></div>
                  <Field label="สูง" value={section.barrierHeight} onChange={(v) => update('barrierHeight', v)} />
                  <Field label="กว้างฐาน" value={section.barrierBase} onChange={(v) => update('barrierBase', v)} />
                  <p className="warning">△ สูง/กว้างฐานเป็นค่าตั้งต้นให้แก้ได้ — ต้องอ่านจากรูปตัดในแบบ RS-608 จริงก่อนใช้คิดปริมาณ</p>
                </section>

                <section className="panel-box single-field"><Field label="เกาะยกสูง" value={section.raisedMedian} onChange={(v) => update('raisedMedian', v)} /></section>

                <section className="panel-box">
                  <h3>Superelevation · นโยบายหมุนรูปตัด</h3>
                  <label className="select-row"><span>แหล่ง e / LT-RT / ช่วง STA</span><select value={section.superSource} onChange={(e) => update('superSource', e.target.value)}><option>Curve Data ตาม Alignment (e / LT-RT / STA)</option><option>กำหนดเองรายช่วง STA</option></select></label>
                  <label className="select-row"><span>แกนหมุน / Pivot</span><select value={section.pivot} onChange={(e) => update('pivot', e.target.value)}><option>PG.(LT.) / PG.(RT.) แยกอิสระ (ตามแบบ 15–18)</option><option>Centerline</option></select></label>
                  <label className="select-row"><span>ความลาดไหล่</span><select value={section.slopeDirection} onChange={(e) => update('slopeDirection', e.target.value)}><option>หมุนตามผิวจราจร</option><option>คงความลาดเดิม</option></select></label>
                  <div className="read-only-row"><span>Normal Crown</span><strong>{section.normalCrown.toFixed(2)}% · อ่านจาก %ลาดผิวจราจร</strong></div>
                </section>

                <p className="footnote">Alignment เป็นเจ้าของ e, ทิศ LT/RT และ SE.ATTAINED/REMOVED · Profile เป็นเจ้าของ PG · รูปตัดนี้สร้าง PG.(LT.)/PG.(RT.) โดยไม่ให้กรอก e ซ้ำ</p>
              </div>
            </div>
          </>
        ) : (
          <div className="preview-page">
            <div className="status-strip">▸ ชุดประกอบชั้นส่วน · {layers.length + 4} ชั้นปูพื้น + 2 ชั้นอื่นกับสถานี · คลุม {totalLength / 1000} กม. <b>ต่อเนื่อง ✓</b> · ยังไม่มีในโมเดล 4</div>
            <div className="preview-toolbar"><strong>รูปตัดขวาง (หน้าตัดจริง)</strong><label>มาตราส่วนแนวตั้ง <select><option>1:1 ตรงแบบก่อสร้าง</option><option>1:2</option></select></label></div>
            <CrossSectionGraphic section={section} />
            <div className="legend-area">
              <strong>ชั้นโครงสร้างทาง (บน → ล่าง)</strong>
              <div className="legend-grid">{layers.map((layer, index) => <div className="legend-item" key={layer.name}><i style={{ background: layer.color }} /> <span>{index + 1}. {layer.name}</span><b>{layer.thickness.toFixed(2)} ม.</b></div>)}</div>
            </div>
            <div className="range-editor">
              <div className="range-header"><strong>📍 ใช้กับช่วง STA (เว้นช่วงได้)</strong><button className="mini-btn" onClick={() => setRanges((current) => [...current, { id: Date.now(), start: current.at(-1)?.end ?? 0, end: (current.at(-1)?.end ?? 0) + 1000 }])}>+ เพิ่มช่วง STA</button></div>
              {ranges.map((range, index) => <div className="range-row" key={range.id}><span>ช่วงที่ {index + 1}</span><input type="number" value={range.start} onChange={(e) => setRanges((current) => current.map((r) => r.id === range.id ? { ...r, start: Number(e.target.value) } : r))} /><span>–</span><input type="number" value={range.end} onChange={(e) => setRanges((current) => current.map((r) => r.id === range.id ? { ...r, end: Number(e.target.value) } : r))} /><em>({formatStation(range.start)}–{formatStation(range.end)})</em><button className="remove-range" onClick={() => setRanges((current) => current.filter((r) => r.id !== range.id))}>×</button></div>)}
            </div>
            <div className="quantity-summary"><strong>ประมาณปริมาณจากหน้าตัดนี้</strong><span>ความยาวรวม {totalLength.toLocaleString()} ม.</span><span>ความกว้างผิวทาง {pavedWidth.toFixed(2)} ม.</span><span>AC Wearing {quantities[0].quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })} ม²</span><span>AC Binder {quantities[1].quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })} ม³</span></div>
          </div>
        )}

        <div className="modal-footer">
          <button className="nav-button" onClick={() => step === 1 ? onClose() : setStep(1)}>← Back</button>
          <button className="nav-button next" onClick={() => setStep(2)}>Next →</button>
          <button className="apply-button">ใช้ค่า</button>
          <div className="footer-spacer" />
          <button className="primary-outline" onClick={onClose}>✓ ตกลง</button>
          <button className="ghost-button" onClick={onClose}>ยกเลิก</button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [modalOpen, setModalOpen] = useState(true)
  const [activeNav, setActiveNav] = useState('ใบ')

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">ช่างคิด</span><strong>BOQ งานทาง สะพาน และท่อเหลี่ยม</strong></div>
        <div className="project-tabs"><button>โครงการของฉัน</button><button className="active">BOQ งานทาง</button><button>คลังแบบมาตรฐาน</button></div>
        <div className="top-actions"><span>หลักเกณฑ์ราคากลาง 2569</span><button>▦</button><button>⚙</button></div>
      </header>

      <div className="workspace">
        <aside className="rail-nav">
          {['HOME', 'ใบ', 'แบบ', 'ผัง', 'รูปตัด', '3 มิติ', 'เทียบรุ่น', 'ล็อกไลน์', 'ส่งออก'].map((item) => <button key={item} className={activeNav === item ? 'active' : ''} onClick={() => setActiveNav(item)}><span>{item === 'HOME' ? '⌂' : item === 'ใบ' ? '▣' : item === 'แบบ' ? '▤' : item === 'ผัง' ? '◎' : item === 'รูปตัด' ? '⌗' : item === '3 มิติ' ? '◇' : item === 'ส่งออก' ? '⇱' : '•'}</span><small>{item}</small></button>)}
        </aside>

        <main className="main-content">
          <section className="boq-column">
            <div className="page-heading"><div><span className="eyebrow">ปริมาณงาน</span><h1>BOQ หลัก 9.650 กม. <b>+0.550 กม. แยกเป็น</b></h1></div><div className="station-pill">STA 31+500.000 – 41+150.000</div></div>

            <div className="scope-tabs"><button className="active">ทั้งโครงการ</button><button>ช่วงงานหลัก 31+500.000 – 41+150.000</button></div>
            <div className="diagnostic"><strong>พิสูจน์แล้ว 0 / 28 บรรทัด</strong><span>ยังไม่ได้จัด</span><button onClick={() => setModalOpen(true)}>ดู/ตั้งแม่แบบรูปตัด</button></div>

            <article className="issue-card"><div className="issue-title"><span>▸</span><strong>ยังพิสูจน์ไม่ได้ 28 บรรทัด — ติดอะไรบ้าง</strong></div><div className="issue-sub">นอกขอบเขตการถอดปริมาณ 1 รายการ</div><div className="issue-sub highlighted">ชั้นออกแบบ · ประมาณการเบื้องต้น 3 รายการ</div></article>

            <section className="boq-list">
              <div className="boq-list-head"><span>รายการ</span><span>สถานะ</span><span>ปริมาณ</span></div>
              {['ผิว AC Wearing หนา 0.05 ม. (พื้นที่)', 'ผิว AC Wearing (น้ำหนัก)', 'AC Binder / Leveling หนา 0.05 ม. (พื้นที่)', 'AC Binder / Leveling (น้ำหนัก)', 'AC Base หนา 0.08 ม. (พื้นที่)', 'AC Base (น้ำหนัก)', 'ผิวจราจรทางไหล่ทาง (พื้นที่)', 'Prime Coat', 'Tack Coat'].map((item, index) => <div className="boq-item" key={item}><span className="diamond">◆</span><span>{item}</span><span className={index < 3 ? 'state amber' : 'state'}>{index < 3 ? 'ยังไม่ผูกแบบ' : 'รอคำนวณ'}</span><b>{index < 3 ? '—' : '0.00'}</b></div>)}
            </section>
          </section>

          <aside className="map-column">
            <div className="map-toolbar"><strong>STA 36+212.000</strong><button>⌖</button></div>
            <div className="fake-map">
              <div className="terrain t1" /><div className="terrain t2" /><div className="terrain t3" />
              <svg viewBox="0 0 300 720" preserveAspectRatio="none"><path d="M158 0 C118 80 186 145 144 224 C108 292 191 354 148 425 C112 486 181 554 137 720" fill="none" stroke="#e34b48" strokeWidth="4"/><path d="M154 0 C116 82 181 146 141 224 C109 292 185 354 145 425 C114 487 176 553 133 720" fill="none" stroke="#f6d4c4" strokeWidth="1.5" strokeDasharray="5 5"/></svg>
              {[96, 175, 258, 344, 436, 526, 611].map((y, i) => <span key={y} className="station-tag" style={{ top: y, left: i % 2 ? 142 : 154 }}>{`STA ${32 + i}+${String((i * 117) % 1000).padStart(3, '0')}`}</span>)}
            </div>
            <div className="map-mini-preview"><CrossSectionGraphic section={initialSection} compact /></div>
          </aside>
        </main>
      </div>

      <footer className="statusbar"><span>หมวด <b>งานทาง</b></span><span>STA 31+500.000 – 41+700.000</span><span>ชนิดงานในหมวดนี้ <b>56 ชนิด · 164 ช่อง</b></span><span>คลังแบบ ทล. <b>322 แบบ</b></span><span>ปริมาณ <b>28 บรรทัด</b></span><span>Factor F (1.499)</span><span className="grow" /><span>พิสูจน์เก็บก่อน 3 มิติ ◆ 0 △ 3</span></footer>

      {modalOpen && <TypicalSectionModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}

export default App
