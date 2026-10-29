import type { ReactNode } from "react";

/** Plain modal: solid scrim (no blur), centred card. */
export function Dialog({ title, children, actions }: { title: string; children?: ReactNode; actions: ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-6 max-sm:p-4">
      <div className="anim-enter w-full max-w-md rounded-2xl border border-hair bg-surface p-8 shadow-[0_24px_48px_-16px_rgb(21_32_27/0.35)] tall:max-w-lg tall:p-10 max-sm:p-6">
        <h2 className="t-title text-fg">{title}</h2>
        {children && <div className="mt-2 text-[17px] leading-normal text-fg-2 tall:text-[20px]">{children}</div>}
        <div className="mt-8 flex flex-col gap-3 max-sm:mt-6">{actions}</div>
      </div>
    </div>
  );
}
