"use client";

import { useRef } from "react";
import { COLUMN_I, CONSENT_VERSION, DIABETIC_CATEGORIES, ENABLE_VIDEO, GENDERS, SHOTS } from "@/lib/config";
import { fmt } from "@/lib/strings";
import { hasErrors, validateConsent, validateDetails } from "@/lib/validate";
import { postSubmission } from "@/lib/submit";
import { STEPS, useActions, useKiosk, useStrings } from "../KioskProvider";
import { Button } from "../ui/Button";
import { IconBack, IconRefresh } from "../ui/icons";
import { ScreenLayout } from "../ui/ScreenLayout";

function Section({ title, onEdit, editLabel, children }: { title: string; onEdit?: () => void; editLabel: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-3xl border-2 border-line bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[24px] font-bold text-brand">{title}</h2>
        {onEdit && (
          <button type="button" onClick={onEdit} className="min-h-14 rounded-xl px-5 font-semibold text-accent active:bg-accent-50">
            {editLabel}
          </button>
        )}
      </div>
      {children}
    </section>
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
  const label = (opts: typeof GENDERS, v: string) => opts.find((o) => o.value === v)?.[s.lang] ?? v;

  const rows: [string, string][] = [
    [t.f.name, d.name.trim()],
    [t.f.age, d.age],
    [t.f.gender, label(GENDERS, d.gender)],
    [t.f.heightCm, d.heightCm],
    [t.f.weightKg, d.weightKg],
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
    if (hasErrors(validateConsent(c, !!s.signature)) || !s.consentedAt) return go(STEPS.consent, true);
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
    if (s.signature) form.append("signature", s.signature.blob, "consent_signature.png");
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
        <div className="mb-4 h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          {submit.progress < 1 ? (
            <div className="h-full origin-left bg-brand transition-transform duration-200" style={{ transform: `scaleX(${submit.progress})` }} />
          ) : (
            <div className="anim-indeterminate h-full w-2/5 bg-accent" />
          )}
        </div>
      )}
      {errMsg && (
        <p role="alert" className="mb-4 rounded-2xl border-2 border-bad/40 bg-bad-50 p-4 font-semibold text-bad">
          {errMsg}
        </p>
      )}

      <Section title={t.secPhotos} editLabel={t.edit} onEdit={canEdit ? () => go(STEPS.camera, true) : undefined}>
        <div className="grid grid-cols-3 gap-3">
          {SHOTS.map((sh) => (
            <figure key={sh.id} className="text-center">
              <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-line">
                {s.captures[sh.id] && (
                  // Small thumbnails straight from the in-memory Blob.
                  <img src={s.captures[sh.id]!.url} alt="" className="mirror h-full w-full object-cover" decoding="async" />
                )}
              </div>
              <figcaption className="mt-1 text-[18px] text-muted">{t.shotNames[sh.id]}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section title={t.secDetails} editLabel={t.edit} onEdit={canEdit ? () => go(STEPS.details, true) : undefined}>
        <dl className="divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-muted">{k.replace(" *", "")}</dt>
              <dd className="text-right font-semibold break-words">{v || t.notSet}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={t.secConsent} editLabel={t.edit} onEdit={canEdit ? () => go(STEPS.consent, true) : undefined}>
        <p className="font-semibold text-good">✓ {t.consentGiven}</p>
        {s.signature && <img src={s.signature.url} alt="" className="mt-3 h-20 rounded-xl border border-line bg-card" />}
      </Section>
    </ScreenLayout>
  );
}
