"use client";

import { useEffect } from "react";
import { SHOTS } from "@/lib/config";
import { loadFaceDetector } from "../camera/detector";
import { loadCaptureScreen } from "../lazy";
import { useActions, useKiosk, useStrings } from "../KioskProvider";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/controls";
import { IconBack, PoseGlyph } from "../ui/icons";
import { ScreenLayout, Section } from "../ui/ScreenLayout";

export default function DosScreen() {
  const t = useStrings();
  const { dosAccepted } = useKiosk();
  const { next, back, dispatch } = useActions();

  // Warm the lazy camera chunk and the face detector (~4 MB once, then cached) while the participant reads.
  useEffect(() => {
    void loadCaptureScreen();
    loadFaceDetector().catch(() => undefined); // the camera screen reports a failure itself
  }, []);

  return (
    <ScreenLayout
      title={t.dosTitle}
      intro={t.dosIntro}
      fill
      actions={
        <>
          <Button variant="secondary" onClick={back} aria-label={t.back}>
            <IconBack />
          </Button>
          <Button className="flex-1" disabled={!dosAccepted} onClick={next}>
            {t.continue}
          </Button>
        </>
      }
    >
      <div className="flex flex-1 flex-col">
        <Section title={t.shotsHeading}>
          {/* Phones: one row per photo (drawing beside its text); wider screens: three columns. */}
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 tall:gap-6">
            {SHOTS.map((s, i) => (
              <li key={s.id} className="flex items-center gap-4 sm:block">
                <div className="flex aspect-square w-[72px] shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg sm:w-auto desk:aspect-[4/3]">
                  <PoseGlyph turn={s.turn} className="w-[62%] desk:w-[46%]" />
                </div>
                <div className="min-w-0">
                  <p className="flex items-baseline gap-2 sm:mt-3 tall:mt-4">
                    <span className="text-[14px] font-semibold text-fg-3 tabular-nums tall:text-[17px]">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[16px] font-semibold text-fg tall:text-[19px]">{t.shotNames[s.id]}</span>
                  </p>
                  <p className="mt-1 text-[14.5px] leading-snug text-fg-2 tall:text-[17px]">{t.shotInstr[s.turn]}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section title={t.howHeading} className="mt-4 tall:mt-6">
          <ol className="divide-y divide-hair">
            {t.howSteps.map((step, i) => (
              <li key={step} className="flex items-center gap-4 py-3 text-[17px] leading-snug text-fg first:pt-0 last:pb-0 tall:py-4 tall:text-[20px]">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mint/10 text-[15px] font-semibold text-mint tabular-nums tall:size-9">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </Section>

        {/* The gate sits at the bottom, right above Continue. */}
        <div className="mt-auto pt-5 tall:pt-8">
          <Checkbox checked={dosAccepted} onChange={(v) => dispatch({ type: "dos", value: v })}>
            <span className="font-medium">{t.readConfirm}</span>
          </Checkbox>
        </div>
      </div>
    </ScreenLayout>
  );
}
