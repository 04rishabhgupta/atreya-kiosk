"use client";

import { useEffect, useRef, useState } from "react";
import { IDLE_COUNTDOWN_S, IDLE_TIMEOUT_MS } from "@/lib/config";
import { fmt, type Strings } from "@/lib/strings";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";

/** Components can call this to count non-touch activity (e.g. an auto-capture) as "still here". */
export const markActive = () => window.dispatchEvent(new Event("kiosk-activity"));

const EVENTS = ["pointerdown", "keydown", "input", "kiosk-activity"] as const;

/** 90 s of no input -> 10 s countdown -> onTimeout. Timers live in refs; only the countdown is state. */
export function IdleGuard({ enabled, onTimeout, t }: { enabled: boolean; onTimeout: () => void; t: Strings }) {
  const [count, setCount] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const timeoutRef = useRef(onTimeout);
  timeoutRef.current = onTimeout;

  useEffect(() => {
    if (!enabled) {
      setCount(null);
      return;
    }
    const arm = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCount(IDLE_COUNTDOWN_S), IDLE_TIMEOUT_MS);
    };
    const onActivity = () => {
      setCount(null);
      arm();
    };
    arm();
    for (const e of EVENTS) window.addEventListener(e, onActivity, { passive: true, capture: true });
    return () => {
      window.clearTimeout(timer.current);
      for (const e of EVENTS) window.removeEventListener(e, onActivity, { capture: true });
    };
  }, [enabled]);

  useEffect(() => {
    if (count === null) return;
    if (count <= 0) {
      setCount(null);
      timeoutRef.current();
      return;
    }
    const id = window.setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [count]);

  if (count === null) return null;
  return (
    <Dialog
      title={t.idleTitle}
      actions={
        <Button className="w-full" onClick={() => setCount(null)}>
          {t.idleStay}
        </Button>
      }
    >
      <p>{fmt(t.idleBody, { n: count })}</p>
      <p className="anim-count mt-5 text-center text-[72px] leading-none font-semibold text-fg tabular-nums" key={count}>
        {count}
      </p>
    </Dialog>
  );
}
