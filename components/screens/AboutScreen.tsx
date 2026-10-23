"use client";

import { useEffect, useRef, useState } from "react";
import { ABOUT_AUTO_ADVANCE_MS } from "@/lib/config";
import { useActions, useStrings } from "../KioskProvider";
import { Button } from "../ui/Button";
import { IllustrationClock, IllustrationData, IllustrationFace, IllustrationNotDx } from "../ui/icons";
import { ScreenLayout } from "../ui/ScreenLayout";

const ART = [IllustrationFace, IllustrationData, IllustrationNotDx, IllustrationClock];

export default function AboutScreen() {
  const t = useStrings();
  const { next } = useActions();
  const cards = t.aboutCards;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef<number | null>(null);

  // Auto-advance until the participant touches the carousel; loops for an attract-mode feel.
  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => setI((n) => (n + 1) % cards.length), ABOUT_AUTO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [i, paused, cards.length]);

  const go = (n: number) => {
    setPaused(true);
    setI(Math.max(0, Math.min(cards.length - 1, n)));
  };

  return (
    <ScreenLayout
      scroll={false}
      actions={
        <Button className="flex-1" onClick={next}>
          {t.continue}
        </Button>
      }
    >
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        onPointerDown={(e) => (startX.current = e.clientX)}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        }}
      >
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {cards.map((c, n) => {
            const Art = ART[n] ?? IllustrationFace;
            return (
              <article
                key={n}
                aria-hidden={n !== i}
                className="flex h-full w-full shrink-0 flex-col items-center justify-center px-4 text-center"
              >
                <Art className="size-48" />
                <h1 className="mt-8 text-[36px] leading-tight font-bold text-brand">{c.title}</h1>
                <p className="mt-4 max-w-xl text-[24px] text-muted">{c.body}</p>
              </article>
            );
          })}
        </div>
      </div>
      <div className="flex justify-center gap-1 pt-2">
        {cards.map((_, n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n + 1}`}
            onClick={() => go(n)}
            className="flex size-14 items-center justify-center"
          >
            <span
              className={`block h-3 w-3 rounded-full transition-transform duration-200 ${
                n === i ? "scale-125 bg-accent" : "bg-line"
              }`}
            />
          </button>
        ))}
      </div>
      <p className="text-center text-[18px] text-muted">{t.swipeHint}</p>
    </ScreenLayout>
  );
}
