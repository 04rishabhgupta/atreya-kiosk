import type { ReactNode } from "react";

/** Scrollable content + persistent bottom action bar. One primary action per screen. */
export function ScreenLayout({
  title,
  intro,
  children,
  actions,
  scroll = true,
  fill = false,
}: {
  title?: string;
  intro?: string;
  children: ReactNode;
  actions: ReactNode;
  scroll?: boolean;
  /** Scrolling screen whose body stretches to the remaining height (so content can be pinned to the bottom). */
  fill?: boolean;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {/* Scrolling screens are a plain block so tall children grow instead of flex-shrinking. */}
      <div
        className={`anim-enter min-h-0 flex-1 px-4 pt-5 pb-5 sm:px-8 sm:pt-7 sm:pb-7 tall:px-12 tall:pt-10 compact:pt-3 compact:pb-3 cramped:pt-3 cramped:pb-3 ${
          scroll ? `overflow-y-auto ${fill ? "flex flex-col" : ""}` : "flex flex-col overflow-hidden"
        }`}
      >
        {title && (
          <header className="mb-4 shrink-0 sm:mb-6 tall:mb-8 compact:mb-3">
            <h1 className="t-title text-fg">{title}</h1>
            {intro && <p className="t-lead mt-1.5 max-w-[46ch]">{intro}</p>}
          </header>
        )}
        {fill ? <div className="flex flex-[1_0_auto] flex-col">{children}</div> : children}
      </div>
      <footer className="flex gap-3 border-t border-hair bg-surface px-4 py-3 sm:px-8 sm:py-4 tall:px-12 tall:py-6 compact:py-2">{actions}</footer>
    </section>
  );
}

/** A white card with a hairline border and an optional small kicker heading — the system's grouping device. */
export function Section({
  title,
  aside,
  children,
  className = "",
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-hair bg-surface p-4 shadow-card sm:p-6 tall:p-8 ${className}`}>
      {title && (
        <div className="mb-4 flex min-h-8 items-center justify-between gap-4 tall:mb-6">
          <h2 className="t-kicker">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
