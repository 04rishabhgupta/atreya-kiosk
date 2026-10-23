"use client";

import { useEffect, useState } from "react";
import { SUCCESS_RESET_S } from "@/lib/config";
import { fmt } from "@/lib/strings";
import { useActions, useKiosk, useStrings } from "../KioskProvider";
import { Button } from "../ui/Button";
import { ScreenLayout } from "../ui/ScreenLayout";

export default function SuccessScreen() {
  const t = useStrings();
  const { referenceId } = useKiosk();
  const { reset } = useActions();
  const [left, setLeft] = useState(SUCCESS_RESET_S);

  // Countdown, then wipe everything (reset revokes all blob URLs; the camera is already closed).
  useEffect(() => {
    if (left <= 0) return reset();
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left, reset]);

  return (
    <ScreenLayout
      scroll={false}
      actions={
        <Button className="flex-1" onClick={reset}>
          {t.done} · {fmt(t.resetIn, { n: left })}
        </Button>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <svg viewBox="0 0 120 120" className="size-40" aria-hidden>
          <circle className="anim-pop" style={{ transformOrigin: "center", transformBox: "fill-box" }} cx="60" cy="60" r="56" fill="#2F9E5B" />
          <path
            className="anim-pop"
            style={{ animationDelay: "0.15s", transformOrigin: "center", transformBox: "fill-box" }}
            d="M36 62l16 16 32-34"
            fill="none"
            stroke="#fff"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h1 className="mt-6 text-[40px] font-bold text-brand">{t.successTitle}</h1>
        <p className="mt-3 max-w-xl text-[22px] text-muted">{t.successBody}</p>
        <div className="mt-8 rounded-3xl border-2 border-accent/50 bg-accent-50 px-8 py-6">
          <p className="text-[20px] text-muted">{t.refLabel}</p>
          <p className="mt-1 font-mono text-[44px] font-bold tracking-wider text-ink select-text">{referenceId}</p>
        </div>
        <p className="mt-4 max-w-lg text-[19px] text-muted">{t.refHint}</p>
      </div>
    </ScreenLayout>
  );
}
