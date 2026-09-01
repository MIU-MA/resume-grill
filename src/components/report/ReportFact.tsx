export function ReportFact({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' }) {
  return (
    <div className="min-w-0 rounded-lg border border-line px-3.5 py-3">
      <div className="mb-1 text-[11px] font-bold text-text-tertiary">{label}</div>
      <p className={`m-0 text-[12px] leading-[1.6] ${tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-text-secondary'}`}>{value}</p>
    </div>
  )
}

