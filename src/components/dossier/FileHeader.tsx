/**
 * The top of every screen: a small label marked with a hex, the title, and an optional
 * one-line summary. Step screens use the Aces Rulebook's step name as the title.
 */
export function FileHeader({ label, position, title, summary, children }: {
  label: string
  position?: string
  title: string
  summary?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="bg-surface-deep/70 border-b border-line">
      <div className="max-w-6xl mx-auto px-gutter pt-4 pb-3 flex flex-col gap-1.5">
        <div className="field-label flex justify-between gap-3 text-text-muted">
          <span className="flex items-center gap-2">
            <svg width="12" height="14" viewBox="0 0 14 16" aria-hidden="true" className="shrink-0">
              <polygon points="7,1 13,4.5 13,11.5 7,15 1,11.5 1,4.5" fill="var(--color-active)" />
            </svg>
            {label}
          </span>
          {position && <span>{position}</span>}
        </div>
        <h1 className="m-0 text-[28px] sm:text-[34px] leading-[1.05] text-text-primary">{title}</h1>
        {summary && <p className="m-0 text-sm text-text-secondary">{summary}</p>}
        {children}
      </div>
    </header>
  )
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="max-w-6xl mx-auto px-gutter py-4 flex flex-col gap-4">{children}</div>
}
