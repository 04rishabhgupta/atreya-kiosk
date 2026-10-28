"use client";

import { useActions, useStrings } from "../KioskProvider";
import { Button } from "../ui/Button";
import { IconArrowRight } from "../ui/icons";
import { ScreenLayout } from "../ui/ScreenLayout";

const BRAND = "atreya.ai";

/**
 * A topographic study of the face oval: fine nested contours that rise as they widen, like a depth scan.
 * One contour is picked out in green; the orange dot is the brand mark's. Static: no ambient animation.
 */
function Contours() {
  const rings = Array.from({ length: 8 }, (_, i) => {
    const rx = 64 + i * 19;
    return { rx, ry: rx * 1.3, cy: 262 - i * 7, o: 0.3 - i * 0.033 };
  });
  return (
    <svg viewBox="0 -48 400 530" className="mx-auto h-[min(320px,30vh)] w-auto short:h-[24vh] tall:h-[min(460px,28vh)]" aria-hidden>
      <ellipse cx="200" cy="262" rx="64" ry="83" fill="#E4ECE8" />
      {rings.map((r, i) => (
        <ellipse key={i} cx="200" cy={r.cy} rx={r.rx} ry={r.ry} fill="none" stroke="#15201B" strokeOpacity={r.o} strokeWidth="1.2" />
      ))}
      <ellipse cx="200" cy={262 - 3 * 7} rx={64 + 3 * 19} ry={(64 + 3 * 19) * 1.3} fill="none" stroke="#1F7A55" strokeWidth="2" />
      <circle cx="292" cy="372" r="9" fill="#E07B28" />
    </svg>
  );
}

/** Sets the brand name in brand green wherever it appears in the (translated) title. */
function Title({ text }: { text: string }) {
  const at = text.indexOf(BRAND);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-brand">{BRAND}</span>
      {text.slice(at + BRAND.length)}
    </>
  );
}

export default function AboutScreen() {
  const t = useStrings();
  const w = t.welcome;
  const { next } = useActions();

  return (
    <ScreenLayout
      actions={
        <Button className="flex-1" onClick={next}>
          {w.start}
          <IconArrowRight />
        </Button>
      }
    >
      <div className="flex min-h-full flex-col items-center text-center">
        <div className="min-h-6 flex-[2]" />
        <div className="anim-fade compact:hidden">
          <Contours />
        </div>

        <p className="t-kicker mt-10 text-mint short:mt-5 tall:mt-14">{w.greeting}</p>
        <h1 className="t-display mt-3 max-w-[16ch] text-balance text-fg short:mt-2 short:max-w-none tall:mt-4">
          <Title text={w.title} />
        </h1>
        <p className="t-lead mt-4 max-w-[34ch] text-balance short:mt-3 tall:mt-5">
          {w.tagline} <span className="text-fg">{w.thanks}</span>
        </p>

        <div className="min-h-10 flex-[3]" />
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[14px] text-fg-3 tall:text-[17px]">
          {w.footnote.map((f, i) => (
            <span key={f} className="flex items-center gap-3">
              {i > 0 && <span className="size-1 rounded-full bg-hair-strong" />}
              {f}
            </span>
          ))}
        </p>
      </div>
    </ScreenLayout>
  );
}
