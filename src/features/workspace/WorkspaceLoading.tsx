export function WorkspaceLoading() {
  return <div role="status" aria-label="正在读取工作台" className="flex min-h-dvh bg-bg"><aside aria-hidden="true" className="w-48 shrink-0 border-r border-line bg-surface-soft p-5 max-sm:hidden"><div className="mb-10 h-6 bg-line" />{Array.from({ length: 6 }, (_, i) => <div key={i} className="mb-5 h-4 bg-line motion-safe:animate-pulse" />)}</aside><main className="flex-1 p-6"><p className="text-body text-text-secondary">正在读取工作台…</p><div aria-hidden="true" className="mt-8 h-64 border border-line bg-surface motion-safe:animate-pulse" /></main></div>
}
