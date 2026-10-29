"use client";

import { useRef } from "react";
import { COLUMN_I, CONSENT_VERSION, DIABETIC_CATEGORIES, ENABLE_VIDEO, GENDERS, SHOTS } from "@/lib/config";
import { fmt } from "@/lib/strings";
import { hasErrors, validateConsent, validateDetails } from "@/lib/validate";
import { postSubmission } from "@/lib/submit";
import { STEPS, useActions, useKiosk, useStrings } from "../KioskProvider";
import { Button } from "../ui/Button";
import { IconBack, IconCheck, IconRefresh } from "../ui/icons";
import { ScreenLayout, Section as Group } from "../ui/ScreenLayout";

function Section({ title, onEdit, editLabel, children }: { title: string; onEdit?: () => void; editLabel: string; children: React.ReactNode }) {
  return (
    <Group
      title={title}
      className="mb-4 tall:mb-6"
      aside={
        onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="min-h-12 rounded-lg border border-hair-strong bg-surface px-5 text-[15px] font-semibold text-brand active:bg-surface-2 tall:min-h-14 tall:text-[17px]"
          >
            {editLabel}
          </button>
        )
      }
    >
      {children}
    </Group>
  );
}

export default function ReviewScreen() {
  const t = useStrings();
  const s = useKiosk();
  const { back, go, dispatch } = useActions();
  const honeypot = useRef<HTMLInputElement>(null);
  const { details: d, consent: c, submit } = s;
  const sending = submit.status === "sending";
  const canEdit = !sending && !submit.locked;
  const label = (opts: typeof DIABETIC_CATEGORIES, v: string) => opts.find((o) => o.value === v)?.[s.lang] ?? v;

  const rows: [string, string][] = [
    [t.f.age, d.age],
    [t.f.gender, label(GENDERS, d.gender)],
    [t.f.diabeticCategory, label(DIABETIC_CATEGORIES, d.diabeticCategory)],
    [t.f.hba1c, d.hba1c],
    ...(COLUMN_I ? ([[COLUMN_I[s.lang], d.columnI]] as [string, string][]) : []),
    [t.f.rbs, d.rbs],
    [t.f.onMedicine, d.onMedicine === "Yes" ? `${t.yes}${d.medicineDetails.trim() ? ` — ${d.medicineDetails.trim()}` : ""}` : d.onMedicine === "No" ? t.no : ""],
  ];

  const doSubmit = async () => {
    if (sending) return;
    // Edits from Review can invalidate an earlier step (e.g. age now under 18): send them back there.
    if (hasErrors(validateDetails(d))) return go(STEPS.details, true);
    if (hasErrors(validateConsent(c)) || !s.consentedAt) return go(STEPS.consent, true);
    if (SHOTS.some((sh) => !s.captures[sh.id])) return go(STEPS.camera, true);
    dispatch({ type: "submit", patch: { status: "sending", progress: 0, error: null } });

    const form = new FormData();
    form.append(
      "data",
      JSON.stringify({
        submissionKey: s.submissionKey,
        details: d,
        consent: { ...c, consentedAt: s.consentedAt, version: CONSENT_VERSION },
      }),
    );
    for (const sh of SHOTS) {
      const cap = s.captures[sh.id];
      if (cap) form.append(sh.id, cap.blob, sh.fileName);
    }
    if (ENABLE_VIDEO && s.video) form.append("video", s.video.blob, "face_video");
    form.append("website", honeypot.current?.value ?? "");

    const res = await postSubmission(form, (p) => dispatch({ type: "submit", patch: { progress: p } }));
    if (res.ok) return dispatch({ type: "submitted", referenceId: res.referenceId });

    // 4xx (except 429) means nothing was stored: allow edits with a fresh key.
    // Anything else may have reached Google: keep the key so Retry is deduplicated, and lock edits.
    const rejected = res.status >= 400 && res.status < 500 && res.status !== 429;
    if (rejected) dispatch({ type: "newKey" });
    dispatch({
      type: "submit",
      patch: { status: "error", error: res.error, locked: submit.locked || (!rejected && res.error !== "rate_limited") },
    });
  };

  const errMsg = submit.error ? (t.submitErr as Record<string, string>)[submit.error] ?? t.submitErr.server : null;
  const pct = Math.round(submit.progress * 100);

  return (
    <ScreenLayout
      title={t.reviewTitle}
      actions={
        <>
          <Button variant="secondary" onClick={back} aria-label={t.back} disabled={!canEdit}>
            <IconBack />
          </Button>
          <Button className="flex-1" onClick={doSubmit} disabled={sending}>
            {sending ? (submit.progress < 1 ? fmt(t.uploading, { n: pct }) : t.saving) : submit.status === "error" ? (
              <>
                <IconRefresh /> {t.retry}
              </>
            ) : (
              t.submit
            )}
          </Button>
        </>
      }
    >
      {/* Honeypot: invisible to people, tempting to bots. */}
      <input
        ref={honeypot}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] h-px w-px opacity-0"
        defaultValue=""
      />

      {sending && (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          {submit.progress < 1 ? (
            <div className="h-full origin-left bg-mint transition-transform duration-200" style={{ transform: `scaleX(${submit.progress})` }} />
          ) : (
            <div className="anim-indeterminate h-full w-2/5 bg-mint" />
          )}
        </div>
      )}
      {errMsg && (
        <p role="alert" className="mb-4 rounded-xl border border-coral/30 bg-coral/[0.06] px-5 py-4 text-[16px] font-medium text-coral tall:text-[19px]">
          {errMsg}
        </p>
      )}

      <Section title={t.secPhotos} editLabel={t.edit} onEdit={canEdit ? () => go(STEPS.camera, true) : undefined}>
        <div className="grid grid-cols-3 gap-4 tall:gap-6">
          {SHOTS.map((sh) => (
            <figure key={sh.id} className="text-center">
              <div className="aspect-[3/4] overflow-hidden rounded-xl bg-surface-2">
                {s.captures[sh.id] && (
                  // Small thumbnails straight from the in-memory Blob.
                  <img src={s.captures[sh.id]!.url} alt="" className="mirror h-full w-full object-cover" decoding="async" />
                )}
              </div>
              <figcaption className="mt-2 text-[14.5px] text-fg-2 tall:text-[17px]">{t.shotNames[sh.id]}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section title={t.secDetails} editLabel={t.edit} onEdit={canEdit ? () => go(STEPS.details, true) : undefined}>
        <dl className="-my-2.5 divide-y divide-hair text-[16px] tall:text-[19px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 py-2.5 tall:py-3.5">
              <dt className="text-fg-2">{k.replace(" *", "")}</dt>
              <dd className="text-right font-medium break-words text-fg">{v || t.notSet}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={t.secConsent} editLabel={t.edit} onEdit={canEdit ? () => go(STEPS.consent, true) : undefined}>
        <p className="flex items-center gap-3 text-[16px] font-medium text-fg tall:text-[19px]">
          <span className="flex size-7 items-center justify-center rounded-full bg-mint/10 text-mint">
            <IconCheck className="size-4" />
          </span>
          {t.consentGiven}
        </p>
      </Section>
    </ScreenLayout>
  );
}
