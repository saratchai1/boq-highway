import { useMemo, useState } from 'react'
import { deriveSectionGeometry, mirrorLeftToRight } from './domain/geometry'
import {
  createInitialRanges,
  createInitialSection,
  DEFAULT_LAYERS,
  type CrossSectionModel,
  type RoadSide,
  type SideKey,
  type StationRange,
} from './domain/models'
import { calculateQuantityProvenance } from './domain/quantity'
import { analyzeStationCoverage, formatStation } from './domain/stations'

const initialSection = createInitialSection()

const Field = ({
  label,
  value,
  suffix = 'ม.',
  onChange,
}: {
  label: string
  value: number
  suffix?: string
  onChange: (value: number) => void
}) => (
  <label className="form-row">
    <span>{label}</span>
    <div className="number-wrap">
      <input type="number" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <small>{suffix}</small>
    </div>
  </label>
)

const segmentLabel = (kind: 'inside-shoulder' | 'lane' | 'outside-shoulder', laneIndex?: number) => {
  if (kind === 'lane') return `เลน ${(laneIndex ?? 0) + 1}`
  if (kind === 'inside-shoulder') return 'ไหล่ใน'
  return 'ไหล่นอก'
}

function CrossSectionGraphic({ section, compact = false }: { section: CrossSectionModel; compact?: boolean }) {
  const geometry = useMemo(() => deriveSectionGeometry(section), [section])
  const center = 500
  const drawingWidth = 780
  const scale = drawingWidth / Math.max(geometry.totalWidth, 1)
  const x = (metres: number) => center + metres * scale
  const medianWidthPx = Math.max(8, section.median * scale)

  return (
    <div className={`section-graphic ${compact ? 'compact' : ''}`}>
      <svg viewBox="0 0 1000 320" role="img" aria-label="Parametric typical road cross section preview">
        <defs>
          <pattern id="pavement" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 8L8 0" stroke="#d27e00" strokeWidth="1" />
          </pattern>
        </defs>

        <line x1="92" x2="908" y1="48" y2="48" className="dimension-line" />
        <line x1="92" x2="92" y1="41" y2="56" className="dimension-line" />
        <line x1="908" x2="908" y1="41" y2="56" className="dimension-line" />
        <text x="500" y="39" textAnchor="middle" className="dimension-text">เขต R.O.W. {section.row.toFixed(2)} ม.</text>

        <line x1={x(geometry.leftEdge)} x2={x(geometry.rightEdge)} y1="78" y2="78" className="dimension-line" />
        <text x="500" y="69" textAnchor="middle" className="dimension-text">เขตก่อสร้าง {geometry.totalWidth.toFixed(2)} ม.</text>

        <polygon
          points={`${x(geometry.leftEdge) - 82},224 ${x(geometry.leftEdge)},190 ${x(geometry.rightEdge)},190 ${x(geometry.rightEdge) + 82},224`}
          fill="#e8c77f"
          opacity="0.88"
        />

        {geometry.segments.map((segment) => {
          const segmentX = x(segment.start)
          const width = Math.max(1, (segment.end - segment.start) * scale)
          const isLane = segment.kind === 'lane'
          const fill = isLane ? '#cfd3d6' : 'url(#pavement)'
          return (
            <g key={segment.id}>
              <rect x={segmentX} y={isLane ? 151 : 161} width={width} height={isLane ? 39 : 29} fill={fill} stroke={isLane ? '#8c959e' : '#bd7800'} />
              {!compact && width > 45 && (
                <text x={segmentX + width / 2} y="145" textAnchor="middle" className="road-label">
                  {segmentLabel(segment.kind, segment.laneIndex)} {segment.width.toFixed(2)}
                </text>
              )}
            </g>
          )
        })}

        <rect x={center - medianWidthPx / 2} y="151" width={medianWidthPx} height="39" fill="#e7e2d6" stroke="#9e9686" />
        <path d={`M ${center - 7} 151 L ${center - 5} 115 L ${center + 5} 115 L ${center + 7} 151 Z`} fill="#9da6ad" stroke="#65717b" />
        <line x1={center} x2={center} y1="115" y2="86" stroke="#616a72" strokeWidth="2" />
        <path d={`M ${center - 18} 89 Q ${center} 73 ${center + 18} 89`} fill="none" stroke="#d8ab00" strokeWidth="3" />

        <text x={center} y="107" textAnchor="middle" className="road-note">{section.barrier.code} · H {section.barrier.height.toFixed(2)} ม.</text>
        <text x={x(geometry.leftEdge) + 25} y="214" className="slope-label">1:{section.left.sideSlope}</text>
        <text x={x(geometry.rightEdge) - 45} y="214" className="slope-label">1:{section.right.sideSlope}</text>
        <text x={x((geometry.leftEdge + geometry.medianStart) / 2)} y="132" textAnchor="middle" className="slope-green">{section.left.crossSlope.toFixed(1)}%</text>
        <text x={x((geometry.medianEnd + geometry.rightEdge) / 2)} y="132" textAnchor="middle" className="slope-green">{section.right.crossSlope.toFixed(1)}%</text>
        <line x1="80" x2="920" y1="224" y2="224" stroke="#72787e" strokeDasharray="6 5" />
        <text x="500" y="242" textAnchor="middle" className="ground-label">ระดับดินเดิม (EXISTING GROUND)</text>
      </svg>
    </div>
  )
}

function SideEditor({
  title,
  side,
  onChange,
}: {
  title: string
  side: RoadSide
  onChange: <K extends keyof RoadSide>(key: K, value: RoadSide[K]) => void
}) {
  const setLane = (index: number, value: number) => onChange('lanes', side.lanes.map((lane, laneIndex) => laneIndex === index ? value : lane))
  const laneTotal = side.lanes.reduce((sum, width) => sum + width, 0)

  return (
    <section className="panel-box">
      <div className="box-heading-row">
        <h3>{title}</h3>
        <div>
          <button className="mini-btn" onClick={() => onChange('lanes', [...side.lanes, 3.5])}>+ เลน</button>
          <button className="mini-btn" disabled={side.lanes.length <= 1} onClick={() => onChange('lanes', side.lanes.slice(0, -1))}>− เลน</button>
        </div>
      </div>
      {side.lanes.map((lane, index) => <Field key={index} label={`เลน ${index + 1}`} value={lane} onChange={(value) => setLane(index, value)} />)}
      <Field label="ไหล่ทางใน" value={side.insideShoulder} onChange={(value) => onChange('insideShoulder', value)} />
      <Field label="ไหล่ทางนอก" value={side.outsideShoulder} onChange={(value) => onChange('outsideShoulder', value)} />
      <Field label="Cross slope" value={side.crossSlope} suffix="%" onChange={(value) => onChange('crossSlope', value)} />
      <Field label="ลาดข้าง m:1" value={side.sideSlope} suffix="" onChange={(value) => onChange('sideSlope', value)} />
      <div className="lane-total"><span>รวมด้านนี้</span><strong>{(laneTotal + side.insideShoulder + side.outsideShoulder).toFixed(2)} ม.</strong></div>
    </section>
  )
}

function CoverageBadge({ analysis }: { analysis: ReturnType<typeof analyzeStationCoverage> }) {
  if (analysis.status === 'complete') return <span className="coverage-badge ok">✓ Coverage ต่อเนื่อง</span>
  if (analysis.status === 'empty') return <span className="coverage-badge neutral">ยังไม่มีช่วง STA</span>
  const count = analysis.findings.length
  return <span className={`coverage-badge ${analysis.status === 'invalid' ? 'bad' : 'warn'}`}>⚠ พบปัญหา {count} จุด</span>
}

function TypicalSectionModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [section, setSection] = useState<CrossSectionModel>(() => createInitialSection())
  const [ranges, setRanges] = useState<StationRange[]>(() => createInitialRanges())
  const [selectedLayerId, setSelectedLayerId] = useState(DEFAULT_LAYERS[0].id)

  const geometry = useMemo(() => deriveSectionGeometry(section), [section])
  const coverage = useMemo(() => analyzeStationCoverage(ranges), [ranges])
  const quantities = useMemo(() => calculateQuantityProvenance(section, ranges, DEFAULT_LAYERS), [section, ranges])
  const selectedQuantity = quantities.find((quantity) => quantity.layerId === selectedLayerId) ?? quantities[0]

  const updateSection = <K extends keyof CrossSectionModel>(key: K, value: CrossSectionModel[K]) => {
    setSection((current) => ({ ...current, [key]: value }))
  }

  const updateSide = <K extends keyof RoadSide>(sideKey: SideKey, key: K, value: RoadSide[K]) => {
    setSection((current) => {
      const next = { ...current, [sideKey]: { ...current[sideKey], [key]: value } }
      return current.symmetric ? mirrorLeftToRight(sideKey === 'left' ? next : { ...next, left: next.right }) : next
    })
  }

  const setSymmetric = (symmetric: boolean) => {
    setSection((current) => symmetric ? mirrorLeftToRight({ ...current, symmetric: true }) : { ...current, symmetric: false })
  }

  const updateRange = (id: string, patch: Partial<StationRange>) => {
    setRanges((current) => current.map((range) => range.id === id ? { ...range, ...patch } : range))
  }

  return (
    <div className="modal-backdrop">
      <div className={`tcs-modal ${step === 2 ? 'preview-mode' : ''}`}>
        <div className="modal-titlebar">
          <strong>{step === 1 ? 'Typical Cross Section · Engineering Model' : 'ตรวจรูปตัด + Quantity Provenance'}</strong>
          <span className="section-code">{section.name}</span>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด">×</button>
        </div>

        {step === 1 ? (
          <>
            <div className="name-row">
              <input value={section.name} onChange={(event) => updateSection('name', event.target.value)} />
              <button className="primary-outline" onClick={() => setStep(2)}>✓ ตรวจผล</button>
              <button className="ghost-button" onClick={onClose}>ยกเลิก</button>
            </div>

            <div className="editor-grid">
              <div className="editor-column">
                <section className="panel-box">
                  <h3>Key Dimensions · ระยะหลัก</h3>
                  <Field label="เกาะกลาง" value={section.median} onChange={(value) => updateSection('median', value)} />
                  <Field label="ทางเท้า" value={section.sidewalk} onChange={(value) => updateSection('sidewalk', value)} />
                  <Field label="เกาะยกสูง" value={section.raisedMedian} onChange={(value) => updateSection('raisedMedian', value)} />
                  <Field label="เขต ROW" value={section.row} onChange={(value) => updateSection('row', value)} />
                  <Field label="เยื้อง ROW (+ขวา)" value={section.rowOffset} onChange={(value) => updateSection('rowOffset', value)} />
                  <label className="select-row"><span>รูปแบบหน้าตัด</span><select value={section.symmetric ? 'sym' : 'asym'} onChange={(event) => setSymmetric(event.target.value === 'sym')}><option value="sym">สมมาตร (ซ้าย = ขวา)</option><option value="asym">ไม่สมมาตร</option></select></label>
                </section>

                <SideEditor title="Left · องค์ประกอบฝั่งซ้าย" side={section.left} onChange={(key, value) => updateSide('left', key, value)} />
                {!section.symmetric && <SideEditor title="Right · องค์ประกอบฝั่งขวา" side={section.right} onChange={(key, value) => updateSide('right', key, value)} />}

                <section className="panel-box">
                  <h3>Geometry derived from components</h3>
                  <div className="metric-grid">
                    <span>ความกว้างก่อสร้าง</span><b>{geometry.totalWidth.toFixed(2)} ม.</b>
                    <span>Effective paved width</span><b>{geometry.pavedWidth.toFixed(2)} ม.</b>
                    <span>จำนวน component</span><b>{geometry.segments.length + 1}</b>
                  </div>
                </section>
              </div>

              <div className="editor-column">
                <section className="panel-box live-panel">
                  <h3>Live parametric section · สร้างจาก component geometry</h3>
                  <CrossSectionGraphic section={section} />
                </section>

                <section className="panel-box">
                  <h3>DOH Standard References · object reference ไม่ใช่ข้อความกระจาย</h3>
                  <div className="reference-list">
                    {section.standards.map((standard) => <div key={standard.code}><span>{standard.title}</span><b>{standard.code}</b></div>)}
                  </div>
                </section>

                <section className="panel-box">
                  <h3>Concrete Barrier · กำแพงคอนกรีตกั้นชน</h3>
                  <div className="read-only-row"><span>แบบมาตรฐาน</span><strong>{section.barrier.code} · {section.barrier.label}</strong></div>
                  <Field label="สูง" value={section.barrier.height} onChange={(value) => updateSection('barrier', { ...section.barrier, height: value })} />
                  <Field label="กว้างฐาน" value={section.barrier.baseWidth} onChange={(value) => updateSection('barrier', { ...section.barrier, baseWidth: value })} />
                  <p className="warning">ค่ามิตินี้ยังต้องตรวจเทียบแบบมาตรฐานฉบับที่ใช้งานจริงก่อนใช้ประมาณราคา production</p>
                </section>

                <section className="panel-box">
                  <h3>Superelevation ownership</h3>
                  <div className="read-only-row"><span>แหล่ง e / LT-RT / STA</span><strong>{section.superelevation.source}</strong></div>
                  <div className="read-only-row"><span>Pivot</span><strong>{section.superelevation.pivot}</strong></div>
                  <div className="read-only-row"><span>Shoulder policy</span><strong>{section.superelevation.shoulderPolicy}</strong></div>
                  <p className="hint">เก็บ ownership ไว้ใน model เพื่อไม่ให้กรอก e ซ้ำหลายจุด; calculation transition จะต่อใน phase ถัดไป</p>
                </section>
              </div>
            </div>
          </>
        ) : (
          <div className="preview-page">
            <div className="status-strip engineering-status">
              <strong>Station Coverage Engine</strong>
              <CoverageBadge analysis={coverage} />
              <span>ครอบคลุมจริง {(coverage.coveredLength / 1000).toFixed(3)} กม.</span>
              <span>Span {(coverage.spanLength / 1000).toFixed(3)} กม.</span>
            </div>

            {coverage.findings.length > 0 && (
              <div className="coverage-findings">
                {coverage.findings.map((finding) => (
                  <div key={finding.id} className={`coverage-finding ${finding.type}`}>
                    <b>{finding.type.toUpperCase()}</b>
                    <span>{finding.message}</span>
                    <em>{Math.max(0, finding.end - finding.start).toLocaleString()} ม.</em>
                  </div>
                ))}
              </div>
            )}

            <CrossSectionGraphic section={section} />

            <div className="range-editor">
              <div className="range-header"><strong>STA assignments · ระบบตรวจ gap / overlap / invalid อัตโนมัติ</strong><button className="mini-btn" onClick={() => {
                const last = ranges.at(-1)
                const start = last?.end ?? 0
                setRanges((current) => [...current, { id: `range-${Date.now()}`, start, end: start + 1000, sectionId: section.id }])
              }}>+ เพิ่มช่วง STA</button></div>
              {ranges.map((range, index) => (
                <div className="range-row" key={range.id}>
                  <span>ช่วงที่ {index + 1}</span>
                  <input type="number" value={range.start} onChange={(event) => updateRange(range.id, { start: Number(event.target.value) })} />
                  <span>–</span>
                  <input type="number" value={range.end} onChange={(event) => updateRange(range.id, { end: Number(event.target.value) })} />
                  <em>({formatStation(range.start)}–{formatStation(range.end)})</em>
                  <button className="remove-range" onClick={() => setRanges((current) => current.filter((item) => item.id !== range.id))}>×</button>
                </div>
              ))}
            </div>

            <section className="provenance-shell">
              <div className="quantity-table">
                <div className="quantity-table-head"><span>BOQ / Layer</span><span>Quantity</span><span>Unit</span></div>
                {quantities.map((quantity) => (
                  <button key={quantity.layerId} className={selectedLayerId === quantity.layerId ? 'active' : ''} onClick={() => setSelectedLayerId(quantity.layerId)}>
                    <span>{quantity.name}</span>
                    <b>{quantity.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
                    <em>{quantity.unit}</em>
                  </button>
                ))}
              </div>

              {selectedQuantity && (
                <div className="provenance-card">
                  <div className="provenance-title"><div><small>Quantity Provenance</small><h3>{selectedQuantity.name}</h3></div><strong>{selectedQuantity.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedQuantity.unit}</strong></div>
                  <div className="formula-box"><span>Formula</span><code>{selectedQuantity.formula}</code></div>
                  {selectedQuantity.standard && <div className="formula-box"><span>Reference</span><code>{selectedQuantity.standard}</code></div>}
                  <div className="contribution-list">
                    {selectedQuantity.contributions.map((contribution) => (
                      <div key={contribution.rangeId}>
                        <span>{contribution.label}</span>
                        <small>{contribution.pavedWidth.toFixed(2)} ม. × {contribution.length.toLocaleString()} ม.</small>
                        <b>{contribution.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedQuantity.unit}</b>
                      </div>
                    ))}
                  </div>
                  {coverage.status !== 'complete' && <p className="provenance-warning">⚠ Quantity แสดงเพื่อ trace source แต่ต้องแก้ gap/overlap/invalid ก่อนถือเป็นปริมาณ final</p>}
                </div>
              )}
            </section>
          </div>
        )}

        <div className="modal-footer">
          <button className="nav-button" onClick={() => step === 1 ? onClose() : setStep(1)}>← Back</button>
          <button className="nav-button next" onClick={() => setStep(2)}>ตรวจผล →</button>
          <div className="footer-spacer" />
          <CoverageBadge analysis={coverage} />
          <button className="primary-outline" disabled={coverage.status === 'invalid'} onClick={onClose}>✓ บันทึก Draft</button>
          <button className="ghost-button" onClick={onClose}>ยกเลิก</button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [modalOpen, setModalOpen] = useState(true)
  const [activeNav, setActiveNav] = useState('ใบ')
  const overviewQuantities = useMemo(
    () => calculateQuantityProvenance(initialSection, createInitialRanges(), DEFAULT_LAYERS),
    [],
  )

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
            <div className="page-heading"><div><span className="eyebrow">ปริมาณงาน · traceable model</span><h1>BOQ หลัก 9.650 กม. <b>Engineering Draft</b></h1></div><div className="station-pill">STA 31+500.000 – 41+150.000</div></div>
            <div className="scope-tabs"><button className="active">ทั้งโครงการ</button><button>ช่วงงานหลัก 31+500.000 – 41+150.000</button></div>
            <div className="diagnostic"><strong>Model-driven quantity</strong><span>ทุกตัวเลขย้อนกลับหา STA ได้</span><button onClick={() => setModalOpen(true)}>เปิด Typical Cross Section</button></div>

            <article className="issue-card">
              <div className="issue-title"><span>▸</span><strong>Engineering checks</strong></div>
              <div className="issue-sub highlighted">พบ STA gap ในตัวอย่างเริ่มต้น — ระบบจะไม่แสดงคำว่า “ต่อเนื่อง” แบบ hard-code อีก</div>
              <div className="issue-sub">Superelevation transition และ authoritative DOH rate rules เป็น phase ถัดไป</div>
            </article>

            <section className="boq-list">
              <div className="boq-list-head"><span>รายการ</span><span>ที่มา</span><span>ปริมาณ</span></div>
              {overviewQuantities.map((quantity) => <div className="boq-item" key={quantity.layerId}><span className="diamond">◆</span><span>{quantity.name}</span><span className="state">{quantity.contributions.length} STA ranges</span><b>{quantity.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })} {quantity.unit}</b></div>)}
            </section>
          </section>

          <aside className="map-column">
            <div className="map-toolbar"><strong>STA 36+212.000</strong><button>⌖</button></div>
            <div className="fake-map">
              <div className="terrain t1" /><div className="terrain t2" /><div className="terrain t3" />
              <svg viewBox="0 0 300 720" preserveAspectRatio="none"><path d="M158 0 C118 80 186 145 144 224 C108 292 191 354 148 425 C112 486 181 554 137 720" fill="none" stroke="#e34b48" strokeWidth="4"/><path d="M154 0 C116 82 181 146 141 224 C109 292 185 354 145 425 C114 487 176 553 133 720" fill="none" stroke="#f6d4c4" strokeWidth="1.5" strokeDasharray="5 5"/></svg>
              {[96, 175, 258, 344, 436, 526, 611].map((top, index) => <span key={top} className="station-tag" style={{ top, left: index % 2 ? 142 : 154 }}>{`STA ${32 + index}+${String((index * 117) % 1000).padStart(3, '0')}`}</span>)}
            </div>
            <div className="map-mini-preview"><CrossSectionGraphic section={initialSection} compact /></div>
          </aside>
        </main>
      </div>

      <footer className="statusbar"><span>หมวด <b>งานทาง</b></span><span>Architecture <b>model / geometry / station / quantity / UI</b></span><span>Validation <b>enabled</b></span><span className="grow" /><span>Draft quantity — ต้อง validate มาตรฐาน ทล. ก่อน production</span></footer>
      {modalOpen && <TypicalSectionModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}

export default App
