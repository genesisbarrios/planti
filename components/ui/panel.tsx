import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Bordered section with a small-caps eyebrow and serif title. */
export function Panel({ title, eyebrow, actions, className = "", children }: PanelProps) {
  const headingId = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className={`rounded-card border border-line bg-surface ${className}`}>
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          {eyebrow ? (
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-muted">{eyebrow}</p>
          ) : null}
          <h2 id={headingId} className="font-display font-semibold text-lg leading-tight text-ink">
            {title}
          </h2>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}
