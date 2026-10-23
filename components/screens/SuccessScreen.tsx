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
        {/* Echoes the welcome contours, now resolved into a single confirmed mark. */}
        <svg viewBox="0 0 200 200" className="size-32 tall:size-44" aria-hidden>
          {[92, 78, 64].map((r, i) => (
            <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#15201B" strokeOpacity={0.06 + i * 0.05} strokeWidth="1.2" />
          ))}
          <circle className="anim-pop" style={{ transformOrigin: "center", transformBox: "fill-box" }} cx="100" cy="100" r="46" fill="#1F7A55" />
          <path
            className="anim-pop"
            style={{ animationDelay: "0.15s", transformOrigin: "center", transformBox: "fill-box" }}
            d="M80 101l14 14 27-29"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="165" cy="150" r="6" fill="#E07B28" />
        </svg>
        <h1 className="t-display mt-6 text-fg tall:mt-8">{t.successTitle}</h1>
        <p className="t-lead mt-2 max-w-[36ch] text-balance">{t.successBody}</p>
        <div className="mt-8 w-full max-w-md rounded-2xl border border-hair bg-surface px-8 pt-5 pb-6 shadow-card tall:mt-12 tall:max-w-lg tall:pt-7 tall:pb-8">
          <p className="t-kicker">{t.refLabel}</p>
          <p className="mt-2 font-mono text-[32px] font-semibold tracking-[0.06em] text-fg select-text tall:text-[40px]">{referenceId}</p>
        </div>
        <p className="mt-5 max-w-[38ch] text-[15px] leading-normal text-fg-3 tall:text-[19px]">{t.refHint}</p>
      </div>
    </ScreenLayout>
  );
}
