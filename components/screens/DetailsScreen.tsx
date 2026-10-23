"use client";

import { useMemo, useState } from "react";
import { COLUMN_I, DIABETIC_CATEGORIES, GENDERS } from "@/lib/config";
import { fmt, type Strings } from "@/lib/strings";
import { hasErrors, validateDetails, type Details, type FieldError } from "@/lib/validate";
import { useActions, useKiosk, useStrings } from "../KioskProvider";
import { Button } from "../ui/Button";
import { Field, inputClass, Segmented, TextInput } from "../ui/controls";
import { IconBack } from "../ui/icons";
import { ScreenLayout } from "../ui/ScreenLayout";

export const errText = (t: Strings, e?: FieldError) =>
  e ? fmt(t.err[e.key], { min: e.min ?? "", max: e.max ?? "" }) : undefined;

type K = keyof Details;

export default function DetailsScreen() {
  const t = useStrings();
  const { details: d, lang } = useKiosk();
  const { next, back, dispatch } = useActions();
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const errors = useMemo(() => validateDetails(d), [d]);

  const set = (patch: Partial<Details>) => dispatch({ type: "details", patch });
  const err = (k: K) => (submitted || touched[k] ? errText(t, errors[k]) : undefined);
  const blur = (k: K) => () => setTouched((x) => (x[k] ? x : { ...x, [k]: true }));

  const num = (k: K, label: string, integer = false, hint?: string) => (
    <Field id={k} label={label} hint={hint} error={err(k)}>
      <TextInput
        id={k}
        inputMode={integer ? "numeric" : "decimal"}
        enterKeyHint="next"
        maxLength={6}
        value={d[k]}
        invalid={!!err(k)}
        onChange={(e) => set({ [k]: e.target.value.replace(/[^\d.,]/g, "") })}
        onBlur={blur(k)}
      />
    </Field>
  );

  const onContinue = () => {
    setSubmitted(true);
    if (!hasErrors(errors)) return next();
    const first = Object.keys(errors)[0];
    const el = first && document.querySelector<HTMLElement>(`[data-field="${first}"]`);
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.querySelector<HTMLElement>("input,select,button")?.focus({ preventScroll: true });
    }
  };

  return (
    <ScreenLayout
      title={t.detailsTitle}
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
      <p className="mb-5 text-muted">{t.detailsIntro}</p>

      <Field id="name" label={t.f.name} error={err("name")}>
        <TextInput
          id="name"
          enterKeyHint="next"
          maxLength={80}
          value={d.name}
          invalid={!!err("name")}
          onChange={(e) => set({ name: e.target.value })}
          onBlur={blur("name")}
        />
      </Field>

      <div className="grid grid-cols-2 gap-x-4">
        {num("age", t.f.age, true)}
        <div />
        {num("heightCm", t.f.heightCm)}
        {num("weightKg", t.f.weightKg)}
      </div>

      <Field id="gender" label={t.f.gender} error={err("gender")}>
        <Segmented
          id="gender"
          value={d.gender}
          invalid={!!err("gender")}
          options={GENDERS.map((g) => ({ value: g.value, label: g[lang] }))}
          onChange={(v) => {
            set({ gender: v });
            blur("gender")();
          }}
        />
      </Field>

      <Field id="diabeticCategory" label={t.f.diabeticCategory} error={err("diabeticCategory")}>
        <select
          id="diabeticCategory"
          value={d.diabeticCategory}
          aria-invalid={!!err("diabeticCategory") || undefined}
          className={inputClass(!!err("diabeticCategory"))}
          onChange={(e) => set({ diabeticCategory: e.target.value })}
          onBlur={blur("diabeticCategory")}
        >
          <option value="" disabled>
            {t.select}
          </option>
          {DIABETIC_CATEGORIES.map((o) => (
            <option key={o.value} value={o.value}>
              {o[lang]}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-x-4">
        {num("hba1c", t.f.hba1c, false, t.optionalHint)}
        {num("rbs", t.f.rbs, true, t.optionalHint)}
        {COLUMN_I && num("columnI", COLUMN_I[lang], true, t.optionalHint)}
      </div>

      <Field id="onMedicine" label={t.f.onMedicine} error={err("onMedicine")}>
        <Segmented
          id="onMedicine"
          value={d.onMedicine}
          options={[
            { value: "Yes" as const, label: t.yes },
            { value: "No" as const, label: t.no },
          ]}
          onChange={(v) => set({ onMedicine: v, medicineDetails: v === "No" ? "" : d.medicineDetails })}
        />
      </Field>

      {d.onMedicine === "Yes" && (
        <Field id="medicineDetails" label={t.f.medicineDetails} error={err("medicineDetails")}>
          <textarea
            id="medicineDetails"
            rows={3}
            maxLength={300}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t.medicinePlaceholder}
            value={d.medicineDetails}
            className={`${inputClass(!!err("medicineDetails"))} py-3`}
            onChange={(e) => set({ medicineDetails: e.target.value })}
            onBlur={blur("medicineDetails")}
          />
        </Field>
      )}

      {submitted && hasErrors(errors) && <p className="font-semibold text-bad">{t.fixErrors}</p>}
    </ScreenLayout>
  );
}
