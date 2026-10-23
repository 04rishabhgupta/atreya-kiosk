import type { ReactNode } from "react";

/** Scrollable content + persistent bottom action bar. One primary action per screen. */
export function ScreenLayout({
  title,
  children,
  actions,
  scroll = true,
}: {
  title?: string;
  children: ReactNode;
  actions: ReactNode;
  scroll?: boolean;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {/* Scrolling screens are a plain block so tall children grow instead of flex-shrinking. */}
      <div className={`anim-enter min-h-0 flex-1 px-6 pt-4 pb-6 ${scroll ? "overflow-y-auto" : "flex flex-col overflow-hidden"}`}>
        {title && <h1 className="mb-4 text-[32px] leading-tight font-bold text-brand">{title}</h1>}
        {children}
      </div>
      <footer className="flex gap-4 border-t border-line bg-card px-6 py-4">{actions}</footer>
    </section>
  );
}
