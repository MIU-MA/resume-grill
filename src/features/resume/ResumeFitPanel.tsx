'use client'
import { useMemo, useState } from 'react'
import { resumeKeywordCoverage, resumeMetricQuestions } from '@/domain/resume-keywords'
import { Dialog } from '@/components/ui/Dialog'
export function ResumeFitPanel({ text, jd, disabled, onChange }: { text: string; jd: string; disabled: boolean; onChange: (text: string) => void }) {
  const [open, setOpen] = useState(false), [facts, setFacts] = useState<Record<string, string>>({})
  const coverage = useMemo(() => resumeKeywordCoverage(text, jd), [text, jd]), questions = useMemo(() => resumeMetricQuestions(text), [text])
  const point = (index: number, radius: number) => { const angle = index * Math.PI / 3 - Math.PI / 2; return `${150 + Math.cos(angle) * radius},${150 + Math.sin(angle) * radius}` }
  return <><button className="border-b border-line px-4 py-2 text-left text-label" disabled={disabled} onClick={() => setOpen(true)}>岗位关键词与事实补充</button>{open && <Dialog open label="岗位关键词与事实补充" onClose={() => setOpen(false)} panelClassName="w-[min(820px,calc(100%-24px))] max-h-[90dvh] overflow-auto border border-line bg-white p-5">
    <header className="mb-4 flex items-center justify-between"><h2 className="text-section font-semibold">岗位关键词与事实补充</h2><button onClick={() => setOpen(false)}>关闭</button></header>
    <p className="text-meta text-text-tertiary">仅比较已识别技术词的字面覆盖，不代表 ATS 通过率或实际能力。缺少的词仅在确实掌握时补充。</p>
    {jd.trim() && coverage.some(row => row.required.length) ? <><svg viewBox="0 0 300 300" role="img" aria-label="岗位技术词覆盖雷达，具体命中与缺失见下方表格" className="mx-auto max-h-64 w-full max-w-72"><polygon points={coverage.map((_, index) => point(index, 100)).join(' ')} fill="none" stroke="var(--color-line-strong)" /><polygon points={coverage.map((row, index) => point(index, row.coverage ?? 0)).join(' ')} fill="var(--color-info-soft)" stroke="var(--color-info)" />{coverage.map((row, index) => <text key={row.category} x={point(index, 125).split(',')[0]} y={point(index, 125).split(',')[1]} textAnchor="middle" fontSize="12" fill="currentColor">{row.category}</text>)}</svg><table className="my-4 w-full text-left text-label"><caption className="text-left">JD 技术关键词覆盖</caption><thead><tr><th>方向</th><th>命中</th><th>未出现</th></tr></thead><tbody>{coverage.map(row => <tr key={row.category} className="border-t border-line"><td className="py-2">{row.category}{row.coverage !== null ? ` ${row.coverage}%` : ' · 未要求'}</td><td>{row.matched.join('、') || '—'}</td><td>{row.missing.join('、') || '—'}</td></tr>)}</tbody></table></> : <p className="my-4">{jd.trim() ? '暂未识别到支持的技术关键词，请对照 JD 手动检查。' : '填写岗位要求后展示覆盖情况。'}</p>}
    <h3 className="mt-4 font-semibold">这些经历还可以补充什么事实</h3><p className="my-2 text-meta">影响范围是什么？如何观察效果？改动前后有什么差异？你个人完成了哪部分？没有可靠数字时写可核对的现象即可。</p>
    {questions.map(({ line, index }) => <div key={line + index} className="my-3 border-t border-line pt-3"><p>{line}</p><label className="mail-label">补充已确认的事实<input className="mail-input" maxLength={500} value={facts[line] ?? ''} onChange={event => setFacts(current => ({ ...current, [line]: event.target.value }))} /></label><button disabled={disabled || !facts[line]?.trim()} onClick={() => { const lines = text.split('\n'); if (lines[index] === line) { lines[index] = `${line}；${facts[line].trim()}`; onChange(lines.join('\n')) } }}>加入修改稿</button></div>)}
    {!questions.length && <p className="my-3">暂未找到需要提示补充的句子，仍可在原文中逐条修改。</p>}
    <p className="text-meta text-text-tertiary">加入后进入现有修改草稿，仍需预览并保存新稿。</p>
  </Dialog>}</>
}
