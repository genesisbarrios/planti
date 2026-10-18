import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ title, children, action, compact = false }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-start gap-2 rounded-lg border border-dashed border-line-strong bg-paper/60 ${
        compact ? "px-4 py-4" : "px-5 py-8"
      }`}
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      {children ? <div className="max-w-prose text-sm leading-relaxed text-ink-muted">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
