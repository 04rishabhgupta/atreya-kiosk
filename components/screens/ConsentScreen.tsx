"use client";

import { useState } from "react";
import { CONSENT_VERSION } from "@/lib/config";
import { hasErrors, isMinor, validateConsent, type Consent } from "@/lib/validate";
import { useActions, useKiosk, useStrings } from "../KioskProvider";
import { SignaturePad } from "../SignaturePad";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/controls";
import { IconBack } from "../ui/icons";
import { ScreenLayout } from "../ui/ScreenLayout";

export default function ConsentScreen() {
  const t = useStrings();
  const { consent: c, details, signature } = useKiosk();
  const { next, back, dispatch, setSignature } = useActions();
  const [submitted, setSubmitted] = useState(false);
  const minor = isMinor(details.age);
  const errors = validateConsent(c, !!signature);
  const show = submitted ? errors : {};

  const set = (patch: Partial<Consent>) => dispatch({ type: "consent", patch });

  const onContinue = () => {
    setSubmitted(true);
    if (hasErrors(errors)) return;
    dispatch({ type: "consentedAt", at: new Date().toISOString() });
    next();
  };

  return (
    <ScreenLayout
      title={t.consentTitle}
      actions={
        <>
          <Button variant="secondary" onClick={back} aria-label={t.back}>
            <IconBack />
          </Button>
          <Button className="flex-1" onClick={onContinue}>
            {t.continue}
          </Button>
        </>
      }
    >
      <ul className="mb-4 rounded-3xl bg-brand-50 p-5">
        {t.consentSummary.map((line) => (
          <li key={line} className="flex gap-3 py-1.5">
            <span className="mt-2.5 size-2.5 shrink-0 rounded-full bg-accent" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <details className="mb-6 rounded-2xl border-2 border-line bg-card">
        <summary className="flex min-h-16 cursor-pointer items-center px-5 font-semibold text-brand">{t.fullTextToggle}</summary>
        <div className="px-5 pb-5 text-[19px]">
          {t.fullText.map((s) => (
            <div key={s.h} className="mt-3">
              <h3 className="font-semibold">{s.h}</h3>
              <p className="text-muted">{s.p}</p>
            </div>
          ))}
          <p className="mt-4 text-[16px] text-muted">{CONSENT_VERSION}</p>
        </div>
      </details>

      <Checkbox checked={c.training} invalid={!!show.training} onChange={(v) => set({ training: v })}>
        {t.cTraining}
      </Checkbox>
      <Checkbox checked={c.notDiagnosis} invalid={!!show.notDiagnosis} onChange={(v) => set({ notDiagnosis: v })}>
        {t.cNotDiagnosis}
      </Checkbox>
      <Checkbox checked={c.ageOrGuardian} invalid={!!show.ageOrGuardian} onChange={(v) => set({ ageOrGuardian: v })}>
        {minor ? t.cGuardian : t.cAdult}
      </Checkbox>
      <div className="mt-4">
        <p className="mb-2 font-semibold">{t.signatureLabel}</p>
        <SignaturePad
          existingUrl={signature?.url ?? null}
          onChange={setSignature}
          clearLabel={t.clear}
          hint={t.signHere}
          invalid={!!show.signature}
        />
      </div>

      {submitted && hasErrors(errors) && <p className="mt-2 font-semibold text-bad">{t.consentRequired}</p>}
    </ScreenLayout>
  );
}
