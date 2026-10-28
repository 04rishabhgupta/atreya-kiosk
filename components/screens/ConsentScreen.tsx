"use client";

import { CONSENT_VERSION } from "@/lib/config";
import { hasErrors, validateConsent } from "@/lib/validate";
import { useActions, useKiosk, useStrings } from "../KioskProvider";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/controls";
import { IconBack, IconCheck } from "../ui/icons";
import { ScreenLayout, Section } from "../ui/ScreenLayout";

export default function ConsentScreen() {
  const t = useStrings();
  const { consent: c } = useKiosk();
  const { next, back, dispatch } = useActions();
  // The single checkbox stands for both statements listed above it, so it sets them together.
  const agreed = !hasErrors(validateConsent(c));
  const setAll = (v: boolean) => dispatch({ type: "consent", patch: { training: v, notDiagnosis: v } });

  const onConfirm = () => {
    if (!agreed) return;
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
          <Button className="flex-1" disabled={!agreed} onClick={onConfirm}>
            {t.consentConfirm}
          </Button>
        </>
      }
    >
      <Section>
        <ul className="divide-y divide-hair">
          {t.consentSummary.map((line) => (
            <li key={line} className="flex gap-3.5 py-3 text-[16px] leading-snug text-fg first:pt-0 last:pb-0 tall:py-4 tall:text-[19px]">
              <span className="mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full bg-mint/10 text-mint tall:size-6">
                <IconCheck className="size-3.5" />
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.fullTextToggle} className="mt-4 tall:mt-5">
        <div className="text-[15px] tall:text-[18px]">
          {t.fullText.map((s) => (
            <div key={s.h} className="mt-3.5 first:mt-0">
              <h3 className="font-semibold text-fg">{s.h}</h3>
              <p className="mt-0.5 leading-normal text-fg-2">{s.p}</p>
            </div>
          ))}
          <p className="mt-4 font-mono text-[12.5px] text-fg-3">{CONSENT_VERSION}</p>
        </div>
      </Section>

      <Section className="mt-4 tall:mt-5">
        <p className="text-[16px] font-semibold text-fg tall:text-[19px]">{t.consentAgreeIntro}</p>
        <ul className="mt-2.5 mb-5 space-y-1.5 text-[16px] leading-snug text-fg tall:text-[19px]">
          {[t.cTraining, t.cNotDiagnosis].map((s) => (
            <li key={s} className="flex gap-3">
              <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-fg-3" />
              {s}
            </li>
          ))}
        </ul>
        <Checkbox checked={agreed} onChange={setAll}>
          <span className="font-medium">{t.cAll}</span>
        </Checkbox>
      </Section>
    </ScreenLayout>
  );
}
