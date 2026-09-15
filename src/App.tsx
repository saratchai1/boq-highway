import { useMemo, useState } from 'react'
import {
  deriveSectionAtStation,
  superelevationAtStation,
  validateTransitionRanges,
  wideningAtStation,
} from './domain/alignment'
import { deriveSectionGeometry, mirrorLeftToRight } from './domain/geometry'
import {
  createInitialRanges,
  createInitialSections,
  createInitialSuperelevation,
  createInitialWidening,
  DEFAULT_LAYERS,
  type CrossSectionModel,
  type RoadSide,
  type SideKey,
  type StationRange,
  type SuperelevationTransition,
  type WideningTransition,
} from './domain/models'
import { calculateProjectQuantityProvenance } from './domain/quantity'
import { analyzeStationCoverage, formatStation } from './domain/stations'

const Field = ({ label, value, suffix = 'ม.', onChange }: { label: string; value: number; suffix?: string; onChange: (value: number) => void }) => (
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

        <polygon points={`${x(geometry.leftEdge) - 82},224 ${x(geometry.leftEdge)},190 ${x(geometry.rightEdge)},190 ${x(geometry.rightEdge) + 82},224`} fill="#e8c77f" opacity="0.88" />

        {geometry.segments.map((segment) => {
          const segmentX = x(segment.start)
          const width = Math.max(1, (segment.end - segment.start) * scale)
          const isLane = segment.kind === 'lane'
          return (
            <g key={segment.id}>
              <rect x={segmentX} y={isLane ? 151 : 161} width={width} height={isLane ? 39 : 29} fill={isLane ? '#cfd3d6' : 'url(#pavement)'} stroke={isLane ? '#8c959e' : '#bd7800'} />
              {!compact && width > 45 && <text x={segmentX + width / 2} y="145" textAnchor="middle" className="road-label">{segmentLabel(segment.kind, segment.laneIndex)} {segment.width.toFixed(2)}</text>}
            </g>
          )
        })}

        <rect x={center - medianWidthPx / 2} y="151" width={medianWidthPx} height="39" fill="#e7e2d6" stroke="#9e9686" />
        <path d={`M ${center - 7} 151 L ${center - 5} 115 L ${center + 5} 115 L ${center + 7} 151 Z`} fill="#9da6ad" stroke="#65717b" />
        <line x1={center} x2={center} y1="115" y2="86" stroke="#616a72" strokeWidth="2" />
        <text x={center} y="107" textAnchor="middle" className="road-note">{section.barrier.code} · H {section.barrier.height.toFixed(2)} ม.</text>
        <text x={x(geometry.leftEdge) + 25} y="214" className="slope-label">1:{section.left.sideSlope}</text>
        <text x={x(geometry.rightEdge) - 45} y="214" className="slope-label">1:{section.right.sideSlope}</text>
        <text x={x((geometry.leftEdge + geometry.medianStart) / 2)} y="132" textAnchor="middle" className="slope-green">{section.left.crossSlope.toFixed(2)}%</text>
        <text x={x((geometry.medianEnd + geometry.rightEdge) / 2)} y="132" textAnchor="middle" className="slope-green">{section.right.crossSlope.toFixed(2)}%</text>
        <line x1="80" x2="920" y1="224" y2="224" stroke="#72787e" strokeDasharray="6 5" />
        <text x="500" y="242" textAnchor="middle" className="ground-label">ระดับดินเดิม (EXISTING GROUND)</text>
      </svg>
    </div>
  )
}

function SideEditor({ title, side, onChange }: { title: string; side: RoadSide; onChange: <K extends keyof RoadSide>(key: K, value: RoadSide[K]) => void }) {
  const setLane = (index: number, value: number) => onChange('lanes', side.lanes.map((lane, laneIndex) => laneIndex === index ? value : lane))
  const total = side.insideShoulder + side.outsideShoulder + side.lanes.reduce((sum, width) => sum + width, 0)
  return (
    <section className="panel-box">
      <div className="box-heading-row">
        <h3>{title}</h3>
        <div><button className="mini-btn" onClick={() => onChange('lanes', [...side.lanes, 3.5])}>+ เลน</button><button className="mini-btn" disabled={side.lanes.length <= 1} onClick={() => onChange('lanes', side.lanes.slice(0, -1))}>− เลน</button></div>
      </div>
      {side.lanes.map((lane, index) => <Field key={index} label={`เลน ${index + 1}`} value={lane} onChange={(value) => setLane(index, value)} />)}
      <Field label="ไหล่ทางใน" value={side.insideShoulder} onChange={(value) => onChange('insideShoulder', value)} />
      <Field label="ไหล่ทางนอก" value={side.outsideShoulder} onChange={(value) => onChange('outsideShoulder', value)} />
      <Field label="Normal cross slope" value={side.crossSlope} suffix="%" onChange={(value) => onChange('crossSlope', value)} />
      <Field label="ลาดข้าง m:1" value={side.sideSlope} suffix="" onChange={(value) => onChange('sideSlope', value)} />
      <div className="lane-total"><span>รวมด้านนี้</span><strong>{total.toFixed(2)} ม.</strong></div>
    </section>
  )
}

function Timeline({ assignments, widening, superelevation, station, onStation }: { assignments: StationRange[]; widening: WideningTransition[]; superelevation: SuperelevationTransition[]; station: number; onStation: (station: number) => void }) {
  const start = Math.min(...assignments.map((item) => item.start))
  const end = Math.max(...assignments.map((item) => item.end))
  const span = Math.max(1, end - start)
  const pct = (value: number) => `${((value - start) / span) * 100}%`
  return (
    <div className="station-timeline">
      <div className="timeline-scale"><span>{formatStation(start)}</span><strong>STA {formatStation(station)}</strong><span>{formatStation(end)}</span></div>
      <div className="timeline-track assignment-track">
        {assignments.map((item) => <div key={item.id} className="timeline-segment" style={{ left: pct(item.start), width: `${((item.end - item.start) / span) * 100}%` }}><span>{item.sectionId.toUpperCase()}</span></div>)}
        <i className="timeline-cursor" style={{ left: pct(station) }} />
      </div>
      <div className="timeline-track widening-track">{widening.map((item) => <div key={item.id} className="timeline-transition" style={{ left: pct(item.start), width: `${((item.end - item.start) / span) * 100}%` }}>W {item.from.toFixed(2)}→{item.to.toFixed(2)}</div>)}</div>
      <div className="timeline-track super-track">{superelevation.map((item) => <div key={item.id} className="timeline-transition" style={{ left: pct(item.start), width: `${((item.end - item.start) / span) * 100}%` }}>SE {item.rightFrom.toFixed(1)}→{item.rightTo.toFixed(1)}%</div>)}</div>
      <input className="timeline-slider" type="range" min={start} max={end} step="10" value={station} onChange={(event) => onStation(Number(event.target.value))} />
    </div>
  )
}

function EngineeringModal({
  sections, setSections, assignments, setAssignments, widening, setWidening, superelevation, setSuperelevation, previewStation, setPreviewStation, onClose,
}: {
  sections: CrossSectionModel[]
  setSections: React.Dispatch<React.SetStateAction<CrossSectionModel[]>>
  assignments: StationRange[]
  setAssignments: React.Dispatch<React.SetStateAction<StationRange[]>>
  widening: WideningTransition[]
  setWidening: React.Dispatch<React.SetStateAction<WideningTransition[]>>
  superelevation: SuperelevationTransition[]
  setSuperelevation: React.Dispatch<React.SetStateAction<SuperelevationTransition[]>>
  previewStation: number
  setPreviewStation: React.Dispatch<React.SetStateAction<number>>
  onClose: () => void
}) {
  const [tab, setTab] = useState<'section' | 'alignment' | 'quantity'>('section')
  const activeAtStation = useMemo(() => deriveSectionAtStation(previewStation, assignments, sections, widening, superelevation), [previewStation, assignments, sections, widening, superelevation])
  const [selectedSectionId, setSelectedSectionId] = useState(activeAtStation?.id ?? sections[0].id)
  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? sections[0]
  const coverage = useMemo(() => analyzeStationCoverage(assignments), [assignments])
  const wideningValidation = useMemo(() => validateTransitionRanges(widening), [widening])
  const superValidation = useMemo(() => validateTransitionRanges(superelevation), [superelevation])
  const quantities = useMemo(() => calculateProjectQuantityProvenance(sections, assignments, DEFAULT_LAYERS, widening, superelevation), [sections, assignments, widening, superelevation])
  const baseline = useMemo(() => calculateProjectQuantityProvenance(sections, assignments, DEFAULT_LAYERS), [sections, assignments])
  const [selectedLayerId, setSelectedLayerId] = useState(DEFAULT_LAYERS[0].id)
  const selectedQuantity = quantities.find((item) => item.layerId === selectedLayerId) ?? quantities[0]
  const sectionGeometry = deriveSectionGeometry(selectedSection)
  const wideningNow = wideningAtStation(previewStation, widening)
  const superNow = superelevationAtStation(previewStation, superelevation, { left: activeAtStation?.left.crossSlope ?? 0, right: activeAtStation?.right.crossSlope ?? 0 })
  const missingSectionAssignments = assignments.filter((assignment) => !sections.some((section) => section.id === assignment.sectionId))
  const finalReady = coverage.status === 'complete' && wideningValidation.status === 'ok' && superValidation.status === 'ok' && missingSectionAssignments.length === 0

  const updateSelected = <K extends keyof CrossSectionModel>(key: K, value: CrossSectionModel[K]) => {
    setSections((current) => current.map((section) => section.id === selectedSection.id ? { ...section, [key]: value } : section))
  }

  const updateSide = <K extends keyof RoadSide>(sideKey: SideKey, key: K, value: RoadSide[K]) => {
    setSections((current) => current.map((section) => {
      if (section.id !== selectedSection.id) return section
      const next = { ...section, [sideKey]: { ...section[sideKey], [key]: value } }
      if (!section.symmetric) return next
      return sideKey === 'left' ? mirrorLeftToRight(next) : { ...mirrorLeftToRight({ ...next, left: next.right }), right: next.right }
    }))
  }

  const setSymmetric = (value: boolean) => setSections((current) => current.map((section) => section.id === selectedSection.id ? (value ? mirrorLeftToRight({ ...section, symmetric: true }) : { ...section, symmetric: false }) : section))
  const updateAssignment = (id: string, patch: Partial<StationRange>) => setAssignments((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  const updateWidening = (id: string, patch: Partial<WideningTransition>) => setWidening((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  const updateSuper = (id: string, patch: Partial<SuperelevationTransition>) => setSuperelevation((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))

  return (
    <div className="modal-backdrop">
      <div className="tcs-modal preview-mode">
        <div className="modal-titlebar"><strong>Highway BOQ · Engineering Workspace</strong><span className={`readiness ${finalReady ? 'ready' : 'not-ready'}`}>{finalReady ? '✓ Model ready' : '⚠ Validation required'}</span><button className="icon-btn" onClick={onClose}>×</button></div>
        <div className="engineering-tabs">
          <button className={tab === 'section' ? 'active' : ''} onClick={() => setTab('section')}>1 · Typical Sections</button>
          <button className={tab === 'alignment' ? 'active' : ''} onClick={() => setTab('alignment')}>2 · STA / Widening / SE</button>
          <button className={tab === 'quantity' ? 'active' : ''} onClick={() => setTab('quantity')}>3 · BOQ Provenance</button>
        </div>

        {tab === 'section' && <div className="editor-grid engineering-body">
          <div className="editor-column">
            <section className="panel-box">
              <h3>Section Catalog · แม่แบบรูปตัด</h3>
              <div className="section-catalog">{sections.map((section) => <button key={section.id} className={selectedSection.id === section.id ? 'active' : ''} onClick={() => setSelectedSectionId(section.id)}><b>{section.name}</b><span>{deriveSectionGeometry(section).totalWidth.toFixed(2)} ม.</span></button>)}</div>
            </section>
            <section className="panel-box">
              <h3>Key Dimensions</h3>
              <Field label="เกาะกลาง" value={selectedSection.median} onChange={(value) => updateSelected('median', value)} />
              <Field label="เขต ROW" value={selectedSection.row} onChange={(value) => updateSelected('row', value)} />
              <Field label="เยื้อง ROW (+ขวา)" value={selectedSection.rowOffset} onChange={(value) => updateSelected('rowOffset', value)} />
              <label className="select-row"><span>รูปแบบหน้าตัด</span><select value={selectedSection.symmetric ? 'sym' : 'asym'} onChange={(event) => setSymmetric(event.target.value === 'sym')}><option value="sym">สมมาตร</option><option value="asym">ไม่สมมาตร</option></select></label>
            </section>
            <SideEditor title="Left · ฝั่งซ้าย" side={selectedSection.left} onChange={(key, value) => updateSide('left', key, value)} />
            {!selectedSection.symmetric && <SideEditor title="Right · ฝั่งขวา" side={selectedSection.right} onChange={(key, value) => updateSide('right', key, value)} />}
          </div>
          <div className="editor-column">
            <section className="panel-box live-panel"><h3>Parametric Section Preview</h3><CrossSectionGraphic section={selectedSection} /></section>
            <section className="panel-box"><h3>Derived Geometry</h3><div className="metric-grid"><span>ความกว้างรวม</span><b>{sectionGeometry.totalWidth.toFixed(2)} ม.</b><span>Effective paved width</span><b>{sectionGeometry.pavedWidth.toFixed(2)} ม.</b><span>Segments</span><b>{sectionGeometry.segments.length}</b></div></section>
            <section className="panel-box"><h3>DOH Standard References</h3><div className="reference-list">{selectedSection.standards.map((standard) => <div key={standard.code}><span>{standard.title}</span><b>{standard.code}</b></div>)}</div><p className="warning">รหัสและมิติใน MVP ต้องเทียบกับแบบมาตรฐาน/เอกสารโครงการฉบับที่ใช้จริงก่อนออก BOQ ทางการ</p></section>
          </div>
        </div>}

        {tab === 'alignment' && <div className="preview-page engineering-body">
          <Timeline assignments={assignments} widening={widening} superelevation={superelevation} station={previewStation} onStation={setPreviewStation} />
          <div className="station-live-grid">
            <section className="panel-box live-panel"><h3>Section @ {formatStation(previewStation)} · {activeAtStation?.name ?? 'No assignment'}</h3>{activeAtStation ? <CrossSectionGraphic section={activeAtStation} /> : <div className="empty-state">ไม่มี TCS assignment ที่ STA นี้</div>}</section>
            <section className="panel-box"><h3>Live station state</h3><div className="metric-grid"><span>Widening LT</span><b>{wideningNow.left.toFixed(3)} ม.</b><span>Widening RT</span><b>{wideningNow.right.toFixed(3)} ม.</b><span>Cross slope LT</span><b>{superNow.left.toFixed(3)}%</b><span>Cross slope RT</span><b>{superNow.right.toFixed(3)}%</b><span>SE transition</span><b>{superNow.transitionId ?? 'Normal crown'}</b></div></section>
          </div>

          <section className="schedule-card">
            <div className="schedule-title"><div><strong>TCS Assignments</strong><span>Coverage: {(coverage.coveredLength / 1000).toFixed(3)} km / span {(coverage.spanLength / 1000).toFixed(3)} km</span></div><span className={`coverage-badge ${coverage.status === 'complete' ? 'ok' : 'warn'}`}>{coverage.status === 'complete' ? '✓ ต่อเนื่อง' : `⚠ ${coverage.findings.length} ปัญหา`}</span></div>
            {assignments.map((item) => <div className="schedule-row assignment-row" key={item.id}><select value={item.sectionId} onChange={(event) => updateAssignment(item.id, { sectionId: event.target.value })}>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select><input type="number" value={item.start} onChange={(event) => updateAssignment(item.id, { start: Number(event.target.value) })} /><span>→</span><input type="number" value={item.end} onChange={(event) => updateAssignment(item.id, { end: Number(event.target.value) })} /><em>{formatStation(item.start)} – {formatStation(item.end)}</em><button onClick={() => setAssignments((current) => current.filter((row) => row.id !== item.id))}>×</button></div>)}
            <button className="add-schedule" onClick={() => { const last = assignments.at(-1); const start = last?.end ?? 0; setAssignments((current) => [...current, { id: `range-${Date.now()}`, start, end: start + 1000, sectionId: sections[0].id }]) }}>+ เพิ่ม TCS assignment</button>
            {coverage.findings.map((finding) => <p key={finding.id} className="validation-line warn">{finding.message}</p>)}
          </section>

          <section className="schedule-card">
            <div className="schedule-title"><div><strong>Widening Transitions</strong><span>เพิ่มความกว้างแบบ linear และรวมเข้า quantity อัตโนมัติ</span></div><span className={`coverage-badge ${wideningValidation.status === 'ok' ? 'ok' : 'warn'}`}>{wideningValidation.status === 'ok' ? '✓ valid' : `⚠ ${wideningValidation.findings.length}`}</span></div>
            {widening.map((item) => <div className="schedule-row widening-row" key={item.id}><select value={item.side} onChange={(event) => updateWidening(item.id, { side: event.target.value as WideningTransition['side'] })}><option value="both">Both</option><option value="left">Left</option><option value="right">Right</option></select><input type="number" value={item.start} onChange={(event) => updateWidening(item.id, { start: Number(event.target.value) })} /><span>→</span><input type="number" value={item.end} onChange={(event) => updateWidening(item.id, { end: Number(event.target.value) })} /><input type="number" step="0.05" value={item.from} onChange={(event) => updateWidening(item.id, { from: Number(event.target.value) })} /><span>→</span><input type="number" step="0.05" value={item.to} onChange={(event) => updateWidening(item.id, { to: Number(event.target.value) })} /><button onClick={() => setWidening((current) => current.filter((row) => row.id !== item.id))}>×</button></div>)}
            <button className="add-schedule" onClick={() => setWidening((current) => [...current, { id: `wide-${Date.now()}`, start: previewStation, end: previewStation + 500, side: 'both', from: 0, to: 0.5 }])}>+ เพิ่ม widening</button>
            {wideningValidation.findings.map((finding) => <p key={finding.id} className="validation-line warn">{finding.message}</p>)}
          </section>

          <section className="schedule-card">
            <div className="schedule-title"><div><strong>Superelevation Transitions</strong><span>LT/RT slope interpolation ตาม STA</span></div><span className={`coverage-badge ${superValidation.status === 'ok' ? 'ok' : 'warn'}`}>{superValidation.status === 'ok' ? '✓ valid' : `⚠ ${superValidation.findings.length}`}</span></div>
            {superelevation.map((item) => <div className="schedule-row super-row" key={item.id}><input type="number" value={item.start} onChange={(event) => updateSuper(item.id, { start: Number(event.target.value) })} /><span>→</span><input type="number" value={item.end} onChange={(event) => updateSuper(item.id, { end: Number(event.target.value) })} /><input type="number" step="0.1" value={item.leftFrom} onChange={(event) => updateSuper(item.id, { leftFrom: Number(event.target.value) })} /><span>→</span><input type="number" step="0.1" value={item.leftTo} onChange={(event) => updateSuper(item.id, { leftTo: Number(event.target.value) })} /><input type="number" step="0.1" value={item.rightFrom} onChange={(event) => updateSuper(item.id, { rightFrom: Number(event.target.value) })} /><span>→</span><input type="number" step="0.1" value={item.rightTo} onChange={(event) => updateSuper(item.id, { rightTo: Number(event.target.value) })} /><button onClick={() => setSuperelevation((current) => current.filter((row) => row.id !== item.id))}>×</button></div>)}
            <button className="add-schedule" onClick={() => setSuperelevation((current) => [...current, { id: `se-${Date.now()}`, start: previewStation, end: previewStation + 500, leftFrom: 2.5, leftTo: -4, rightFrom: 2.5, rightTo: 4, pivot: 'split-pg' }])}>+ เพิ่ม superelevation</button>
            {superValidation.findings.map((finding) => <p key={finding.id} className="validation-line warn">{finding.message}</p>)}
          </section>
        </div>}

        {tab === 'quantity' && <div className="preview-page engineering-body">
          <div className="status-strip engineering-status"><strong>Quantity Engine</strong><span>Section assignments + widening integrated</span><span className={`coverage-badge ${finalReady ? 'ok' : 'warn'}`}>{finalReady ? '✓ Ready for review' : '⚠ Draft only'}</span></div>
          <section className="impact-strip">{quantities.slice(0, 3).map((item, index) => { const delta = item.quantity - (baseline[index]?.quantity ?? 0); return <div key={item.layerId}><small>{item.name}</small><b>{item.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })} {item.unit}</b><span>Widening impact {delta >= 0 ? '+' : ''}{delta.toLocaleString(undefined, { maximumFractionDigits: 1 })} {item.unit}</span></div> })}</section>
          <section className="provenance-shell">
            <div className="quantity-table"><div className="quantity-table-head"><span>BOQ / Layer</span><span>Quantity</span><span>Unit</span></div>{quantities.map((item) => <button key={item.layerId} className={selectedLayerId === item.layerId ? 'active' : ''} onClick={() => setSelectedLayerId(item.layerId)}><span>{item.name}</span><b>{item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b><em>{item.unit}</em></button>)}</div>
            {selectedQuantity && <div className="provenance-card"><div className="provenance-title"><div><small>Quantity Provenance</small><h3>{selectedQuantity.name}</h3></div><strong>{selectedQuantity.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedQuantity.unit}</strong></div><div className="formula-box"><span>Formula</span><code>{selectedQuantity.formula}</code></div>{selectedQuantity.standard && <div className="formula-box"><span>Reference</span><code>{selectedQuantity.standard}</code></div>}<div className="contribution-list">{selectedQuantity.contributions.map((item) => <div key={item.rangeId}><span>{item.label}</span><small>avg width {item.pavedWidth.toFixed(3)} ม. × {item.length.toLocaleString()} ม.</small><b>{item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedQuantity.unit}</b></div>)}</div>{!finalReady && <p className="provenance-warning">แก้ validation findings ก่อนใช้ตัวเลขเป็น final BOQ</p>}</div>}
          </section>
        </div>}

        <div className="modal-footer"><span className="footer-note">Draft engineering model · authoritative DOH dimensions/rates must be project-validated</span><div className="footer-spacer" /><button className="primary-outline" disabled={!finalReady} onClick={onClose}>✓ บันทึกโมเดล</button><button className="ghost-button" onClick={onClose}>ปิด</button></div>
      </div>
    </div>
  )
}

function App() {
  const [modalOpen, setModalOpen] = useState(true)
  const [activeNav, setActiveNav] = useState('ใบ')
  const [sections, setSections] = useState<CrossSectionModel[]>(() => createInitialSections())
  const [assignments, setAssignments] = useState<StationRange[]>(() => createInitialRanges())
  const [widening, setWidening] = useState<WideningTransition[]>(() => createInitialWidening())
  const [superelevation, setSuperelevation] = useState<SuperelevationTransition[]>(() => createInitialSuperelevation())
  const [previewStation, setPreviewStation] = useState(34800)

  const coverage = useMemo(() => analyzeStationCoverage(assignments), [assignments])
  const quantities = useMemo(() => calculateProjectQuantityProvenance(sections, assignments, DEFAULT_LAYERS, widening, superelevation), [sections, assignments, widening, superelevation])
  const currentSection = useMemo(() => deriveSectionAtStation(previewStation, assignments, sections, widening, superelevation), [previewStation, assignments, sections, widening, superelevation])

  return (
    <div className="app-shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">ช่างคิด</span><strong>BOQ งานทาง สะพาน และท่อเหลี่ยม</strong></div><div className="project-tabs"><button>โครงการของฉัน</button><button className="active">BOQ งานทาง</button><button>คลังแบบมาตรฐาน</button></div><div className="top-actions"><span>หลักเกณฑ์ราคากลาง 2569</span><button>▦</button><button>⚙</button></div></header>
      <div className="workspace">
        <aside className="rail-nav">{['HOME', 'ใบ', 'แบบ', 'ผัง', 'รูปตัด', '3 มิติ', 'เทียบรุ่น', 'ล็อกไลน์', 'ส่งออก'].map((item) => <button key={item} className={activeNav === item ? 'active' : ''} onClick={() => setActiveNav(item)}><span>{item === 'HOME' ? '⌂' : item === 'ใบ' ? '▣' : item === 'แบบ' ? '▤' : item === 'ผัง' ? '◎' : item === 'รูปตัด' ? '⌗' : item === '3 มิติ' ? '◇' : item === 'ส่งออก' ? '⇱' : '•'}</span><small>{item}</small></button>)}</aside>
        <main className="main-content">
          <section className="boq-column">
            <div className="page-heading"><div><span className="eyebrow">ปริมาณงาน · model-driven / traceable</span><h1>BOQ หลัก 9.650 กม. <b>Engineering Model</b></h1></div><div className="station-pill">STA 31+500.000 – 41+150.000</div></div>
            <div className="scope-tabs"><button className="active">ทั้งโครงการ</button><button>{assignments.length} TCS assignments · {widening.length} widening · {superelevation.length} SE</button></div>
            <div className="diagnostic"><strong>{coverage.status === 'complete' ? '✓ STA coverage complete' : `⚠ ${coverage.findings.length} station findings`}</strong><span>ทุก BOQ ย้อนกลับถึง TCS + STA ได้</span><button onClick={() => setModalOpen(true)}>เปิด Engineering Workspace</button></div>
            <article className="issue-card"><div className="issue-title"><span>▸</span><strong>Model checks</strong></div><div className="issue-sub">TCS assignment coverage · Widening transition · Superelevation transition · Quantity provenance</div><div className="issue-sub highlighted">ตัวเลขมาตรฐาน ทล. และราคาต่อหน่วยยังต้อง validate จากเอกสารโครงการก่อนใช้ commercial estimate</div></article>
            <section className="boq-list"><div className="boq-list-head"><span>รายการ</span><span>ที่มา</span><span>ปริมาณ</span></div>{quantities.map((item) => <div className="boq-item" key={item.layerId}><span className="diamond">◆</span><span>{item.name}</span><span className="state">{item.contributions.length} TCS ranges</span><b>{item.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })} {item.unit}</b></div>)}</section>
          </section>
          <aside className="map-column"><div className="map-toolbar"><strong>Alignment schematic · {formatStation(previewStation)}</strong><button onClick={() => setModalOpen(true)}>⌖</button></div><div className="fake-map"><div className="terrain t1" /><div className="terrain t2" /><div className="terrain t3" /><svg viewBox="0 0 300 720" preserveAspectRatio="none"><path d="M158 0 C118 80 186 145 144 224 C108 292 191 354 148 425 C112 486 181 554 137 720" fill="none" stroke="#e34b48" strokeWidth="4"/><path d="M154 0 C116 82 181 146 141 224 C109 292 185 354 145 425 C114 487 176 553 133 720" fill="none" stroke="#f6d4c4" strokeWidth="1.5" strokeDasharray="5 5"/></svg>{[31500, 33300, 35100, 37200, 38750, 41150].map((sta, index) => <button key={sta} className="station-tag station-button" style={{ top: 70 + index * 95, left: index % 2 ? 142 : 154 }} onClick={() => setPreviewStation(sta)}>{formatStation(sta)}</button>)}</div><div className="map-mini-preview">{currentSection && <CrossSectionGraphic section={currentSection} compact />}</div></aside>
        </main>
      </div>
      <footer className="statusbar"><span>หมวด <b>งานทาง</b></span><span>Coverage <b>{(coverage.coveredLength / 1000).toFixed(3)} km</b></span><span>TCS <b>{sections.length}</b></span><span>Widening <b>{widening.length}</b></span><span>SE <b>{superelevation.length}</b></span><span className="grow" /><span>Model-driven BOQ · Draft until standards validated</span></footer>
      {modalOpen && <EngineeringModal sections={sections} setSections={setSections} assignments={assignments} setAssignments={setAssignments} widening={widening} setWidening={setWidening} superelevation={superelevation} setSuperelevation={setSuperelevation} previewStation={previewStation} setPreviewStation={setPreviewStation} onClose={() => setModalOpen(false)} />}
    </div>
  )
}

export default App
