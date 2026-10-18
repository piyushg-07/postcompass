import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
