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
import { IconGlobe } from "./ui/icons";

// Only the camera step pulls in camera code, and only on the client.
const CaptureScreen = dynamic(loadCaptureScreen, {
  ssr: false,
  loading: () => <Loading />,
});

function Loading() {
  const t = useStrings();
  return <div className="flex flex-1 items-center justify-center text-muted">{t.loading}</div>;
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
      <header className="bg-card px-6 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-[26px] font-bold tracking-tight text-brand">
            atreya<span className="text-accent">.ai</span>
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => a.dispatch({ type: "lang", lang: s.lang === "en" ? "hi" : "en" })}
            className="flex min-h-14 items-center gap-2 rounded-xl border-2 border-line px-4 font-semibold text-brand active:bg-brand-50"
          >
            <IconGlobe />
            {t.langToggle}
          </button>
          {inFlow && s.submit.status !== "sending" && (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-14 rounded-xl px-4 font-semibold text-muted active:bg-brand-50"
            >
              {t.startOver}
            </button>
          )}
        </div>
        <StepIndicator step={s.step} label={t.stepNames[s.step] ?? ""} stepOf={t.stepOf} />
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
          <p className="text-[22px]">{t.startOverBody}</p>
        </Dialog>
      )}
    </div>
  );
}

function StepIndicator({ step, label, stepOf }: { step: number; label: string; stepOf: string }) {
  return (
    <div className="mt-3">
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <div key={i} className="h-2 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full origin-left rounded-full bg-brand transition-transform duration-300"
              style={{ transform: `scaleX(${i <= step ? 1 : 0})` }}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[18px] text-muted">
        {fmt(stepOf, { n: step + 1, total: STEP_COUNT })} · <span className="font-semibold text-ink">{label}</span>
      </p>
    </div>
  );
}
