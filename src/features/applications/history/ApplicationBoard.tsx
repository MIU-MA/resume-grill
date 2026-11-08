import { APPLICATION_STAGES, type ApplicationProgress } from '@/domain/application-progress'
import { applicationEntryStage, type ApplicationEntry } from './lib/application-entry'
export function ApplicationBoard({ entries, progress, onSelect }: { entries: ApplicationEntry[]; progress: Record<string, ApplicationProgress>; onSelect: (id: string) => void }) {
  const columns = Object.entries(APPLICATION_STAGES)
  return <div className="flex min-h-0 flex-1 gap-3 overflow-auto bg-surface-soft p-4" aria-label="投递漏斗看板">{[...columns, ['delivery', '待发送 / 需处理']].map(([stage, label]) => {
    const items = entries.filter(entry => (applicationEntryStage(entry, progress[entry.id]) ?? 'delivery') === stage)
    return <section key={stage} className="w-64 shrink-0 border border-line bg-white"><h2 className="border-b border-line p-3 text-label font-semibold">{label} · {items.length}</h2><div className="max-h-[65vh] space-y-2 overflow-auto p-2">{items.map(entry => <button key={entry.id} className="block w-full border border-line p-3 text-left text-label hover:bg-surface-soft" onClick={() => onSelect(entry.id)}><strong className="block">{entry.company}</strong><span>{entry.role || entry.contact}</span></button>)}</div></section>
  })}</div>
}
