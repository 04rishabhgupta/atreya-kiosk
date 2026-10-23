import type { ReactNode } from "react";

/** Plain modal: solid scrim (no blur), centred card. */
export function Dialog({ title, children, actions }: { title: string; children?: ReactNode; actions: ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-6">
      <div className="anim-enter w-full max-w-lg rounded-3xl bg-card p-8">
        <h2 className="text-[28px] font-bold text-brand">{title}</h2>
        {children && <div className="mt-3 text-muted">{children}</div>}
        <div className="mt-8 flex flex-col gap-3">{actions}</div>
      </div>
    </div>
  );
}
