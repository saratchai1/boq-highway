import { useMemo, useState } from 'react'
import { deriveSectionAtStation, superelevationAtStation, validateTransitionRanges, wideningAtStation } from './domain/alignment'
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
import {
  calculateCostEstimate,
  DEFAULT_ESTIMATE_SETTINGS,
  DEFAULT_RATES,
  estimateToCsv,
  type EstimateSettings,
  type RateItem,
} from './domain/cost'

type WorkspaceTab = 'boq' | 'sections' | 'alignment' | 'cost'

type ProjectSnapshot = {
  sections: CrossSectionModel[]
  assignments: StationRange[]
  widening: WideningTransition[]
  superelevation: SuperelevationTransition[]
  rates: RateItem[]
  settings: EstimateSettings
  previewStation: number
}

const STORAGE_KEY = 'boq-highway-project-v1'

const money = (value: number) => value.toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })

function Field({ label, value, suffix = 'ม.', onChange }: { label: string; value: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="form-row"><span>{label}</span><div className="number-wrap"><input type="number" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} /><small>{suffix}</small></div></label>
}

function CrossSectionGraphic({ section }: { section: CrossSectionModel }) {
  const geometry = useMemo(() => deriveSectionGeometry(section), [section])
  const center = 500
  const scale = 780 / Math.max(geometry.totalWidth, 1)
  const x = (metres: number) => center + metres * scale
  const medianPx = Math.max(8, section.median * scale)

  return <div className="section-graphic"><svg viewBox="0 0 1000 300" role="img" aria-label="Typical cross section">
    <defs><pattern id="pave" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#d27e00" strokeWidth="1" /></pattern></defs>
    <line x1="90" x2="910" y1="42" y2="42" className="dimension-line" /><text x="500" y="32" textAnchor="middle" className="dimension-text">R.O.W. {section.row.toFixed(2)} ม.</text>
    <line x1={x(geometry.leftEdge)} x2={x(geometry.rightEdge)} y1="72" y2="72" className="dimension-line" /><text x="500" y="62" textAnchor="middle" className="dimension-text">ความกว้างก่อสร้าง {geometry.totalWidth.toFixed(2)} ม.</text>
    <polygon points={`${x(geometry.leftEdge) - 70},220 ${x(geometry.leftEdge)},188 ${x(geometry.rightEdge)},188 ${x(geometry.rightEdge) + 70},220`} fill="#e8c77f" />
    {geometry.segments.map((segment) => {
      const segmentX = x(segment.start)
      const width = Math.max(1, (segment.end - segment.start) * scale)
      const lane = segment.kind === 'lane'
      return <g key={segment.id}><rect x={segmentX} y={lane ? 150 : 160} width={width} height={lane ? 38 : 28} fill={lane ? '#cfd3d6' : 'url(#pave)'} stroke={lane ? '#8c959e' : '#bd7800'} />{width > 44 && <text x={segmentX + width / 2} y="142" textAnchor="middle" className="road-label">{lane ? `เลน ${(segment.laneIndex ?? 0) + 1}` : segment.kind === 'inside-shoulder' ? 'ไหล่ใน' : 'ไหล่นอก'} {segment.width.toFixed(2)}</text>}</g>
    })}
    <rect x={center - medianPx / 2} y="150" width={medianPx} height="38" fill="#e7e2d6" stroke="#9e9686" />
    <path d={`M ${center - 7} 150 L ${center - 5} 114 L ${center + 5} 114 L ${center + 7} 150 Z`} fill="#9da6ad" stroke="#65717b" />
    <text x={center} y="105" textAnchor="middle" className="road-note">{section.barrier.code}</text>
    <text x={x((geometry.leftEdge + geometry.medianStart) / 2)} y="132" textAnchor="middle" className="slope-green">{section.left.crossSlope.toFixed(2)}%</text>
    <text x={x((geometry.medianEnd + geometry.rightEdge) / 2)} y="132" textAnchor="middle" className="slope-green">{section.right.crossSlope.toFixed(2)}%</text>
    <line x1="80" x2="920" y1="220" y2="220" stroke="#72787e" strokeDasharray="6 5" /><text x="500" y="242" textAnchor="middle" className="ground-label">EXISTING GROUND</text>
  </svg></div>
}

function SideEditor({ title, side, onChange }: { title: string; side: RoadSide; onChange: <K extends keyof RoadSide>(key: K, value: RoadSide[K]) => void }) {
  const setLane = (index: number, value: number) => onChange('lanes', side.lanes.map((lane, i) => i === index ? value : lane))
  return <section className="panel-box"><div className="box-heading-row"><h3>{title}</h3><div><button className="mini-btn" onClick={() => onChange('lanes', [...side.lanes, 3.5])}>+ เลน</button><button className="mini-btn" disabled={side.lanes.length <= 1} onClick={() => onChange('lanes', side.lanes.slice(0, -1))}>− เลน</button></div></div>{side.lanes.map((lane, index) => <Field key={index} label={`เลน ${index + 1}`} value={lane} onChange={(value) => setLane(index, value)} />)}<Field label="ไหล่ใน" value={side.insideShoulder} onChange={(value) => onChange('insideShoulder', value)} /><Field label="ไหล่นอก" value={side.outsideShoulder} onChange={(value) => onChange('outsideShoulder', value)} /><Field label="Cross slope" value={side.crossSlope} suffix="%" onChange={(value) => onChange('crossSlope', value)} /><Field label="ลาดข้าง m:1" value={side.sideSlope} suffix="" onChange={(value) => onChange('sideSlope', value)} /></section>
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [tab, setTab] = useState<WorkspaceTab>('boq')
  const [sections, setSections] = useState<CrossSectionModel[]>(() => createInitialSections())
  const [assignments, setAssignments] = useState<StationRange[]>(() => createInitialRanges())
  const [widening, setWidening] = useState<WideningTransition[]>(() => createInitialWidening())
  const [superelevation, setSuperelevation] = useState<SuperelevationTransition[]>(() => createInitialSuperelevation())
  const [rates, setRates] = useState<RateItem[]>(() => DEFAULT_RATES.map((rate) => ({ ...rate })))
  const [settings, setSettings] = useState<EstimateSettings>(() => ({ ...DEFAULT_ESTIMATE_SETTINGS }))
  const [previewStation, setPreviewStation] = useState(34800)
  const [selectedSectionId, setSelectedSectionId] = useState('tcs-2')
  const [notice, setNotice] = useState('')

  const coverage = useMemo(() => analyzeStationCoverage(assignments), [assignments])
  const wideningValidation = useMemo(() => validateTransitionRanges(widening), [widening])
  const superValidation = useMemo(() => validateTransitionRanges(superelevation), [superelevation])
  const quantities = useMemo(() => calculateProjectQuantityProvenance(sections, assignments, DEFAULT_LAYERS, widening, superelevation), [sections, assignments, widening, superelevation])
  const estimate = useMemo(() => calculateCostEstimate(quantities, rates, settings), [quantities, rates, settings])
  const currentSection = useMemo(() => deriveSectionAtStation(previewStation, assignments, sections, widening, superelevation), [previewStation, assignments, sections, widening, superelevation])
  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? sections[0]
  const missingAssignments = assignments.filter((assignment) => !sections.some((section) => section.id === assignment.sectionId))
  const modelReady = coverage.status === 'complete' && wideningValidation.status === 'ok' && superValidation.status === 'ok' && missingAssignments.length === 0
  const stationStart = Math.min(...assignments.map((item) => item.start))
  const stationEnd = Math.max(...assignments.map((item) => item.end))
  const wideningNow = wideningAtStation(previewStation, widening)
  const superNow = superelevationAtStation(previewStation, superelevation, { left: currentSection?.left.crossSlope ?? 0, right: currentSection?.right.crossSlope ?? 0 })

  const snapshot = (): ProjectSnapshot => ({ sections, assignments, widening, superelevation, rates, settings, previewStation })
  const save = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot())); setNotice('บันทึกโครงการในเครื่องแล้ว') }
  const load = () => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return setNotice('ยังไม่มีข้อมูลที่บันทึกไว้')
    try {
      const data = JSON.parse(raw) as ProjectSnapshot
      setSections(data.sections); setAssignments(data.assignments); setWidening(data.widening); setSuperelevation(data.superelevation); setRates(data.rates); setSettings(data.settings); setPreviewStation(data.previewStation); setNotice('โหลดโครงการแล้ว')
    } catch { setNotice('ไฟล์บันทึกไม่ถูกต้อง') }
  }
  const exportJson = () => downloadText('boq-highway-project.json', JSON.stringify(snapshot(), null, 2), 'application/json')
  const exportCsv = () => downloadText('boq-highway-estimate.csv', '\ufeff' + estimateToCsv(estimate), 'text/csv;charset=utf-8')

  const updateSection = <K extends keyof CrossSectionModel>(key: K, value: CrossSectionModel[K]) => setSections((current) => current.map((section) => section.id === selectedSection.id ? { ...section, [key]: value } : section))
  const updateSide = <K extends keyof RoadSide>(sideKey: SideKey, key: K, value: RoadSide[K]) => setSections((current) => current.map((section) => {
    if (section.id !== selectedSection.id) return section
    const next = { ...section, [sideKey]: { ...section[sideKey], [key]: value } }
    if (!section.symmetric) return next
    return sideKey === 'left' ? mirrorLeftToRight(next) : { ...mirrorLeftToRight({ ...next, left: next.right }), right: next.right }
  }))

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">ช่างคิด</span><strong>BOQ Highway</strong></div>
      <div className="project-tabs"><button className={tab === 'boq' ? 'active' : ''} onClick={() => setTab('boq')}>BOQ</button><button className={tab === 'sections' ? 'active' : ''} onClick={() => setTab('sections')}>Typical Section</button><button className={tab === 'alignment' ? 'active' : ''} onClick={() => setTab('alignment')}>STA / Widening / SE</button><button className={tab === 'cost' ? 'active' : ''} onClick={() => setTab('cost')}>ราคา / Factor F</button></div>
      <div className="top-actions"><button onClick={save}>Save</button><button onClick={load}>Load</button><button onClick={exportJson}>JSON</button></div>
    </header>

    <main className="complete-workspace">
      <section className="workspace-main">
        <div className="page-heading"><div><span className="eyebrow">Model-driven · traceable · editable</span><h1>BOQ งานทาง <b>{modelReady ? 'Model ready' : 'Validation required'}</b></h1></div><div className="station-pill">{formatStation(stationStart)} – {formatStation(stationEnd)}</div></div>
        {notice && <div className="notice-strip">{notice}<button onClick={() => setNotice('')}>×</button></div>}

        {tab === 'boq' && <>
          <section className="summary-grid"><div><small>Coverage</small><strong>{(coverage.coveredLength / 1000).toFixed(3)} km</strong><span>{coverage.status}</span></div><div><small>Direct cost</small><strong>{money(estimate.directSubtotal)}</strong><span>before Factor F</span></div><div><small>Factor F</small><strong>{settings.factorF.toFixed(3)}</strong><span>editable</span></div><div><small>Grand total</small><strong>{money(estimate.grandTotal)}</strong><span>incl. VAT</span></div></section>
          <section className="boq-list"><div className="boq-list-head"><span>รายการ</span><span>ที่มา</span><span>ปริมาณ</span></div>{quantities.map((item) => <div className="boq-item" key={item.layerId}><span className="diamond">◆</span><span>{item.name}</span><span className="state">{item.contributions.length} TCS ranges</span><b>{item.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })} {item.unit}</b></div>)}</section>
          <section className="panel-box"><h3>Traceability</h3>{quantities.map((item) => <details key={item.layerId} className="trace-row"><summary>{item.name} · {item.formula}</summary>{item.contributions.map((c) => <div key={c.rangeId}><span>{c.label}</span><span>avg width {c.pavedWidth.toFixed(3)} m</span><b>{c.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit}</b></div>)}</details>)}</section>
        </>}

        {tab === 'sections' && <div className="section-editor-layout">
          <aside className="section-list">{sections.map((section) => <button key={section.id} className={section.id === selectedSection.id ? 'active' : ''} onClick={() => setSelectedSectionId(section.id)}><b>{section.name}</b><span>{deriveSectionGeometry(section).totalWidth.toFixed(2)} ม.</span></button>)}</aside>
          <div><section className="panel-box"><h3>Key Dimensions</h3><Field label="R.O.W." value={selectedSection.row} onChange={(value) => updateSection('row', value)} /><Field label="Median" value={selectedSection.median} onChange={(value) => updateSection('median', value)} /><label className="select-row"><span>รูปแบบ</span><select value={selectedSection.symmetric ? 'sym' : 'asym'} onChange={(e) => updateSection('symmetric', e.target.value === 'sym')}><option value="sym">สมมาตร</option><option value="asym">ไม่สมมาตร</option></select></label></section><SideEditor title="Left" side={selectedSection.left} onChange={(key, value) => updateSide('left', key, value)} />{!selectedSection.symmetric && <SideEditor title="Right" side={selectedSection.right} onChange={(key, value) => updateSide('right', key, value)} />}</div>
          <div><CrossSectionGraphic section={selectedSection} /><section className="panel-box"><h3>Standard References</h3><div className="reference-list">{selectedSection.standards.map((standard) => <div key={standard.code}><span>{standard.title}</span><b>{standard.code}</b></div>)}</div></section></div>
        </div>}

        {tab === 'alignment' && <>
          <section className="panel-box"><h3>Station preview · {formatStation(previewStation)}</h3><input className="timeline-slider" type="range" min={stationStart} max={stationEnd} step="10" value={previewStation} onChange={(e) => setPreviewStation(Number(e.target.value))} /><div className="metric-grid"><span>Widening LT</span><b>{wideningNow.left.toFixed(3)} m</b><span>Widening RT</span><b>{wideningNow.right.toFixed(3)} m</b><span>SE LT</span><b>{superNow.left.toFixed(3)}%</b><span>SE RT</span><b>{superNow.right.toFixed(3)}%</b></div>{currentSection && <CrossSectionGraphic section={currentSection} />}</section>
          <section className="schedule-card"><div className="schedule-title"><strong>TCS Assignments</strong><span className={`coverage-badge ${coverage.status === 'complete' ? 'ok' : 'warn'}`}>{coverage.status}</span></div>{assignments.map((item) => <div className="schedule-row assignment-row" key={item.id}><select value={item.sectionId} onChange={(e) => setAssignments((rows) => rows.map((row) => row.id === item.id ? { ...row, sectionId: e.target.value } : row))}>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select><input type="number" value={item.start} onChange={(e) => setAssignments((rows) => rows.map((row) => row.id === item.id ? { ...row, start: Number(e.target.value) } : row))} /><span>→</span><input type="number" value={item.end} onChange={(e) => setAssignments((rows) => rows.map((row) => row.id === item.id ? { ...row, end: Number(e.target.value) } : row))} /><em>{formatStation(item.start)} – {formatStation(item.end)}</em><button onClick={() => setAssignments((rows) => rows.filter((row) => row.id !== item.id))}>×</button></div>)}<button className="add-schedule" onClick={() => { const last = assignments.at(-1); const start = last?.end ?? 0; setAssignments((rows) => [...rows, { id: `r-${Date.now()}`, start, end: start + 1000, sectionId: sections[0].id }]) }}>+ Assignment</button>{coverage.findings.map((finding) => <p key={finding.id} className="validation-line warn">{finding.message}</p>)}</section>
          <section className="schedule-card"><div className="schedule-title"><strong>Widening</strong><span className={`coverage-badge ${wideningValidation.status === 'ok' ? 'ok' : 'warn'}`}>{wideningValidation.status}</span></div>{widening.map((item) => <div className="schedule-row widening-row" key={item.id}><select value={item.side} onChange={(e) => setWidening((rows) => rows.map((row) => row.id === item.id ? { ...row, side: e.target.value as WideningTransition['side'] } : row))}><option value="both">Both</option><option value="left">Left</option><option value="right">Right</option></select><input type="number" value={item.start} onChange={(e) => setWidening((rows) => rows.map((row) => row.id === item.id ? { ...row, start: Number(e.target.value) } : row))} /><span>→</span><input type="number" value={item.end} onChange={(e) => setWidening((rows) => rows.map((row) => row.id === item.id ? { ...row, end: Number(e.target.value) } : row))} /><input type="number" step="0.05" value={item.from} onChange={(e) => setWidening((rows) => rows.map((row) => row.id === item.id ? { ...row, from: Number(e.target.value) } : row))} /><span>→</span><input type="number" step="0.05" value={item.to} onChange={(e) => setWidening((rows) => rows.map((row) => row.id === item.id ? { ...row, to: Number(e.target.value) } : row))} /><button onClick={() => setWidening((rows) => rows.filter((row) => row.id !== item.id))}>×</button></div>)}<button className="add-schedule" onClick={() => setWidening((rows) => [...rows, { id: `w-${Date.now()}`, start: previewStation, end: previewStation + 500, side: 'both', from: 0, to: .5 }])}>+ Widening</button></section>
          <section className="schedule-card"><div className="schedule-title"><strong>Superelevation</strong><span className={`coverage-badge ${superValidation.status === 'ok' ? 'ok' : 'warn'}`}>{superValidation.status}</span></div>{superelevation.map((item) => <div className="schedule-row super-row" key={item.id}><input type="number" value={item.start} onChange={(e) => setSuperelevation((rows) => rows.map((row) => row.id === item.id ? { ...row, start: Number(e.target.value) } : row))} /><span>→</span><input type="number" value={item.end} onChange={(e) => setSuperelevation((rows) => rows.map((row) => row.id === item.id ? { ...row, end: Number(e.target.value) } : row))} /><input type="number" step="0.1" value={item.leftFrom} onChange={(e) => setSuperelevation((rows) => rows.map((row) => row.id === item.id ? { ...row, leftFrom: Number(e.target.value) } : row))} /><span>→</span><input type="number" step="0.1" value={item.leftTo} onChange={(e) => setSuperelevation((rows) => rows.map((row) => row.id === item.id ? { ...row, leftTo: Number(e.target.value) } : row))} /><input type="number" step="0.1" value={item.rightFrom} onChange={(e) => setSuperelevation((rows) => rows.map((row) => row.id === item.id ? { ...row, rightFrom: Number(e.target.value) } : row))} /><span>→</span><input type="number" step="0.1" value={item.rightTo} onChange={(e) => setSuperelevation((rows) => rows.map((row) => row.id === item.id ? { ...row, rightTo: Number(e.target.value) } : row))} /></div>)}</section>
        </>}

        {tab === 'cost' && <>
          <section className="cost-settings"><label>Factor F<input type="number" step="0.001" value={settings.factorF} onChange={(e) => setSettings((s) => ({ ...s, factorF: Number(e.target.value) }))} /></label><label>VAT %<input type="number" step="0.1" value={settings.vatPercent} onChange={(e) => setSettings((s) => ({ ...s, vatPercent: Number(e.target.value) }))} /></label><label>Contingency %<input type="number" step="0.1" value={settings.contingencyPercent} onChange={(e) => setSettings((s) => ({ ...s, contingencyPercent: Number(e.target.value) }))} /></label><button onClick={() => setSettings({ ...DEFAULT_ESTIMATE_SETTINGS })}>Reset</button></section>
          <section className="cost-table"><div className="cost-head"><span>Code</span><span>รายการ</span><span>Qty</span><span>Unit</span><span>Unit rate</span><span>Cost</span></div>{estimate.lines.map((line) => <div className="cost-row" key={line.layerId}><code>{line.code}</code><span>{line.description}</span><b>{line.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b><span>{line.unit}</span><input type="number" value={line.unitRate} onChange={(e) => setRates((rows) => rows.map((row) => row.layerId === line.layerId ? { ...row, unitRate: Number(e.target.value) } : row))} /><strong>{money(line.directCost)}</strong></div>)}</section>
          <section className="estimate-summary"><div><span>Direct subtotal</span><b>{money(estimate.directSubtotal)}</b></div><div><span>Contingency</span><b>{money(estimate.contingency)}</b></div><div><span>After Factor F × {estimate.factorF.toFixed(3)}</span><b>{money(estimate.factoredSubtotal)}</b></div><div><span>VAT</span><b>{money(estimate.vat)}</b></div><div className="grand"><span>Grand total</span><strong>{money(estimate.grandTotal)}</strong></div><div className="export-actions"><button onClick={exportCsv}>Export CSV</button><button onClick={exportJson}>Export Project JSON</button></div></section>
        </>}
      </section>

      <aside className="workspace-side"><div className="side-status"><small>Current STA</small><strong>{formatStation(previewStation)}</strong><input type="range" min={stationStart} max={stationEnd} step="10" value={previewStation} onChange={(e) => setPreviewStation(Number(e.target.value))} /></div>{currentSection && <CrossSectionGraphic section={currentSection} />}<section className="panel-box"><h3>Model status</h3><div className="metric-grid"><span>Coverage</span><b>{coverage.status}</b><span>Widening</span><b>{wideningValidation.status}</b><span>Superelevation</span><b>{superValidation.status}</b><span>Missing TCS</span><b>{missingAssignments.length}</b></div></section><section className="panel-box"><h3>Estimate status</h3><div className="metric-grid"><span>Direct</span><b>{money(estimate.directSubtotal)}</b><span>Factor F</span><b>{settings.factorF.toFixed(3)}</b><span>Grand</span><b>{money(estimate.grandTotal)}</b></div></section></aside>
    </main>

    <footer className="statusbar"><span>BOQ Highway</span><span>STA {(coverage.coveredLength / 1000).toFixed(3)} km</span><span>{sections.length} TCS</span><span>{widening.length} widening</span><span>{superelevation.length} SE</span><span className="grow" /><strong>{modelReady ? 'READY' : 'CHECK MODEL'}</strong></footer>
  </div>
}

export default App
