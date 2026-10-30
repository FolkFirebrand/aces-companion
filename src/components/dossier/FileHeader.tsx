/**
 * The top of every screen: a dossier label, the stencil title, and an optional one-line
 * summary, closed by an amber rule. Step screens use the Aces Rulebook's step name as the title.
 */
export function FileHeader({ label, position, title, summary, children }: {
  label: string
  position?: string
  title: string
  summary?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="bg-steel-800 border-b-2 border-amber">
      <div className="max-w-6xl mx-auto px-gutter pt-4 pb-3 flex flex-col gap-1.5">
        <div className="dossier-label flex justify-between gap-3 text-text-secondary">
          <span>{label}</span>
          {position && <span>{position}</span>}
        </div>
        <h1 className="m-0 text-[28px] sm:text-[34px] leading-[1.05] text-amber">{title}</h1>
        {summary && <p className="m-0 text-sm text-text-secondary">{summary}</p>}
        {children}
      </div>
    </header>
  )
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="max-w-6xl mx-auto px-gutter py-4 flex flex-col gap-4">{children}</div>
}
