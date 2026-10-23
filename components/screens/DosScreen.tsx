"use client";

import { useEffect } from "react";
import { loadCaptureScreen } from "../lazy";
import { useActions, useKiosk, useStrings } from "../KioskProvider";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/controls";
import { IconBack, IconCheck, IconX, IllustrationDo, IllustrationDont } from "../ui/icons";
import { ScreenLayout } from "../ui/ScreenLayout";

function Card({ good, heading, items }: { good: boolean; heading: string; items: string[] }) {
  const Art = good ? IllustrationDo : IllustrationDont;
  const Icon = good ? IconCheck : IconX;
  return (
    <div className={`mb-4 rounded-3xl border-2 bg-card p-5 ${good ? "border-good/40" : "border-bad/30"}`}>
      <div className="mb-3 flex items-center gap-4">
        <Art />
        <h2 className={`text-[28px] font-bold ${good ? "text-brand" : "text-bad"}`}>{heading}</h2>
      </div>
      <ul>
        {items.map((it) => (
          <li key={it} className="flex items-start gap-3 py-1.5 text-[21px]">
            <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-white ${good ? "bg-good" : "bg-bad"}`}>
              <Icon className="size-5" />
            </span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DosScreen() {
  const t = useStrings();
  const { dosAccepted } = useKiosk();
  const { next, back, dispatch } = useActions();

  // Warm the lazy camera chunk while the participant reads (helps on slow Wi-Fi).
  useEffect(() => {
    void loadCaptureScreen();
  }, []);

  return (
    <ScreenLayout
      title={t.dosTitle}
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
      <Card good heading={t.dosHeading} items={t.dosList} />
      <Card good={false} heading={t.dontsHeading} items={t.dontsList} />
      <Checkbox checked={dosAccepted} onChange={(v) => dispatch({ type: "dos", value: v })}>
        <span className="font-semibold">{t.readConfirm}</span>
      </Checkbox>
    </ScreenLayout>
  );
}
