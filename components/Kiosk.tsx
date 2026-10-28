"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fmt } from "@/lib/strings";
import { IdleGuard } from "./IdleGuard";
import { loadCaptureScreen } from "./lazy";
import { KioskProvider, STEP_COUNT, STEPS, useActions, useKiosk, useStrings } from "./KioskProvider";
import AboutScreen from "./screens/AboutScreen";
import ConsentScreen from "./screens/ConsentScreen";
import DetailsScreen from "./screens/DetailsScreen";
import DosScreen from "./screens/DosScreen";
import ReviewScreen from "./screens/ReviewScreen";
import SuccessScreen from "./screens/SuccessScreen";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { BrandMark, IconGlobe, IconRefresh } from "./ui/icons";

// Only the camera step pulls in camera code, and only on the client.
const CaptureScreen = dynamic(loadCaptureScreen, {
  ssr: false,
  loading: () => <Loading />,
});

function Loading() {
  const t = useStrings();
  return <div className="flex flex-1 items-center justify-center text-[17px] text-fg-3">{t.loading}</div>;
}

export default function Kiosk() {
  return (
    <KioskProvider>
      <Shell />
    </KioskProvider>
  );
}

function Shell() {
  const s = useKiosk();
  const a = useActions();
  const t = useStrings();
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    document.documentElement.lang = s.lang;
  }, [s.lang]);

  // Kiosk hardening: no context menu, no pinch / gesture zoom.
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    const multiTouch = (e: TouchEvent) => e.touches.length > 1 && e.preventDefault();
    window.addEventListener("contextmenu", prevent);
    document.addEventListener("gesturestart", prevent);
    document.addEventListener("touchmove", multiTouch, { passive: false });
    return () => {
      window.removeEventListener("contextmenu", prevent);
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("touchmove", multiTouch);
    };
  }, []);

  const inFlow = s.step > STEPS.about && s.step < STEPS.success;
  const idleEnabled = inFlow && s.submit.status !== "sending";

  const reset = () => {
    setConfirmReset(false);
    a.reset();
  };

  let screen: React.ReactNode;
  switch (s.step) {
    case STEPS.about: screen = <AboutScreen />; break;
    case STEPS.dos: screen = <DosScreen />; break;
    case STEPS.camera: screen = <CaptureScreen />; break;
    case STEPS.details: screen = <DetailsScreen />; break;
    case STEPS.consent: screen = <ConsentScreen />; break;
    case STEPS.review: screen = <ReviewScreen />; break;
    default: screen = <SuccessScreen />;
  }

  return (
    <div className="app-h flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-hair bg-surface px-6 sm:px-8 tall:px-12">
        <div className="flex min-h-[72px] items-center gap-2 tall:min-h-[88px]">
          <span className="flex items-center gap-2.5">
            <BrandMark className="size-7 tall:size-8" />
            <span className="text-[18px] font-semibold tracking-[-0.01em] text-brand tall:text-[21px]">
              atreya<span className="text-ember">.ai</span>
            </span>
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => a.dispatch({ type: "lang", lang: s.lang === "en" ? "hi" : "en" })}
            className="flex min-h-12 items-center gap-2 rounded-full border border-hair-strong px-4 text-[15px] font-medium text-fg-2 active:bg-surface-2 tall:min-h-14 tall:px-5 tall:text-[17px]"
          >
            <IconGlobe className="size-[17px]" />
            {t.langToggle}
          </button>
          {inFlow && s.submit.status !== "sending" && (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="flex min-h-12 items-center gap-2 rounded-full px-4 text-[15px] font-medium text-fg-3 active:bg-surface-2 tall:min-h-14 tall:text-[17px]"
            >
              <IconRefresh className="size-[17px]" />
              {t.startOver}
            </button>
          )}
        </div>
        {/* The welcome screen is an invitation, not a form step: no progress there. */}
        {s.step !== STEPS.about && <StepIndicator step={s.step} label={t.stepNames[s.step] ?? ""} stepOf={t.stepOf} />}
      </header>

      <main key={`${s.session}-${s.step}`} className="flex min-h-0 flex-1 flex-col">
        {screen}
      </main>

      <IdleGuard enabled={idleEnabled} onTimeout={a.reset} t={t} />
      {confirmReset && (
        <Dialog
          title={t.startOverTitle}
          actions={
            <>
              <Button variant="danger" onClick={reset}>
                {t.startOverConfirm}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                {t.cancel}
              </Button>
            </>
          }
        >
          <p>{t.startOverBody}</p>
        </Dialog>
      )}
    </div>
  );
}

function StepIndicator({ step, label, stepOf }: { step: number; label: string; stepOf: string }) {
  const pct = ((step + 1) / STEP_COUNT) * 100;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="pb-4 tall:pb-5">
      <p className="mb-3 flex items-baseline gap-3" aria-label={`${fmt(stepOf, { n: step + 1, total: STEP_COUNT })} · ${label}`}>
        <span className="text-[17px] leading-none font-semibold text-fg tabular-nums tall:text-[20px]">{pad(step + 1)}</span>
        <span className="text-[14px] text-fg-3 tabular-nums tall:text-[16px]">/ {pad(STEP_COUNT)}</span>
        <span className="ml-1 text-[15px] font-medium text-fg-2 tall:text-[17px]">{label}</span>
      </p>
      <div className="relative h-[3px] rounded-full bg-surface-3" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-full bg-mint transition-[width] duration-300" style={{ width: `${pct}%` }} />
        <div
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ember transition-[left] duration-300"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
