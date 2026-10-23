// Hand-written validation shared by the client (inline errors) and the server (trust nothing).
import { COLUMN_I, CONSENT_VERSION, DIABETIC_CATEGORIES, GENDERS, LIMITS, RANGES } from "./config";

export interface Details {
  name: string;
  age: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  diabeticCategory: string;
  hba1c: string;
  columnI: string;
  rbs: string;
  onMedicine: "" | "Yes" | "No";
  medicineDetails: string;
}

export interface Consent {
  training: boolean;
  notDiagnosis: boolean;
  ageOrGuardian: boolean;
}

export const emptyDetails: Details = {
  name: "",
  age: "",
  gender: "",
  heightCm: "",
  weightKg: "",
  diabeticCategory: "",
  hba1c: "",
  columnI: "",
  rbs: "",
  onMedicine: "",
  medicineDetails: "",
};

export const emptyConsent: Consent = {
  training: false,
  notDiagnosis: false,
  ageOrGuardian: false,
};

export type ErrKey = "required" | "name" | "number" | "integer" | "range" | "tooLong" | "choice";
export interface FieldError {
  key: ErrKey;
  min?: number;
  max?: number;
}

// Letters (any script, incl. Devanagari marks), spaces, dot, apostrophe, hyphen.
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;

export function cleanText(s: string, max: number): string {
  return s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function parseNum(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (t === "" || !/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

function checkName(v: string, max: number): FieldError | undefined {
  const t = v.trim();
  if (!t) return { key: "required" };
  if (t.length > max) return { key: "tooLong", max };
  if (t.length < 2 || !NAME_RE.test(t)) return { key: "name" };
  return undefined;
}

function checkNum(
  v: string,
  [min, max]: readonly [number, number],
  required: boolean,
  integer = false,
): FieldError | undefined {
  if (v.trim() === "") return required ? { key: "required" } : undefined;
  const n = parseNum(v);
  if (n === null) return { key: "number" };
  if (integer && !Number.isInteger(n)) return { key: "integer" };
  if (n < min || n > max) return { key: "range", min, max };
  return undefined;
}

const has = (opts: { value: string }[], v: string) => opts.some((o) => o.value === v);

export type DetailsErrors = Partial<Record<keyof Details, FieldError>>;

export function validateDetails(d: Details): DetailsErrors {
  const e: DetailsErrors = {};
  e.name = checkName(d.name, LIMITS.nameMax);
  e.age = checkNum(d.age, RANGES.age, true, true);
  e.gender = d.gender ? (has(GENDERS, d.gender) ? undefined : { key: "choice" }) : { key: "required" };
  e.heightCm = checkNum(d.heightCm, RANGES.heightCm, true);
  e.weightKg = checkNum(d.weightKg, RANGES.weightKg, true);
  e.diabeticCategory = d.diabeticCategory
    ? has(DIABETIC_CATEGORIES, d.diabeticCategory)
      ? undefined
      : { key: "choice" }
    : { key: "required" };
  e.hba1c = checkNum(d.hba1c, RANGES.hba1c, false);
  e.columnI = COLUMN_I ? checkNum(d.columnI, [COLUMN_I.min, COLUMN_I.max], false) : undefined;
  e.rbs = checkNum(d.rbs, RANGES.rbs, false);
  if (d.onMedicine !== "" && d.onMedicine !== "Yes" && d.onMedicine !== "No") e.onMedicine = { key: "choice" };
  if (d.medicineDetails.length > LIMITS.medicineMax) e.medicineDetails = { key: "tooLong", max: LIMITS.medicineMax };
  for (const k of Object.keys(e) as (keyof Details)[]) if (!e[k]) delete e[k];
  return e;
}

export const isMinor = (age: string) => {
  const n = parseNum(age);
  return n !== null && n < 18;
};

export type ConsentErrors = Partial<Record<keyof Consent, FieldError>>;

/** All three statements are required. The kiosk sets them together from its single consent checkbox. */
export function validateConsent(c: Consent): ConsentErrors {
  const e: ConsentErrors = {};
  if (!c.training) e.training = { key: "required" };
  if (!c.notDiagnosis) e.notDiagnosis = { key: "required" };
  if (!c.ageOrGuardian) e.ageOrGuardian = { key: "required" };
  return e;
}

export const hasErrors = (e: object) => Object.keys(e).length > 0;

// ---------------- Server-side parsing of the submitted JSON ----------------

export interface SubmissionPayload {
  submissionKey: string;
  details: Details;
  consent: Consent & { consentedAt: string; version: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID_RE.test(s);

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length <= max ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/** Returns the parsed payload, or the name of the first bad field (never its value). */
export function parsePayload(raw: unknown): { ok: true; value: SubmissionPayload } | { ok: false; field: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, field: "body" };
  const r = raw as Record<string, unknown>;
  if (!isUuid(r.submissionKey)) return { ok: false, field: "submissionKey" };

  const d = (r.details ?? {}) as Record<string, unknown>;
  const details = {} as Details;
  for (const k of Object.keys(emptyDetails) as (keyof Details)[]) {
    const max = k === "name" ? LIMITS.nameMax : k === "medicineDetails" ? LIMITS.medicineMax : 20;
    const v = str(d[k], max);
    if (v === null) return { ok: false, field: k };
    (details as unknown as Record<string, string>)[k] = v;
  }
  const dErr = validateDetails(details);
  const firstBad = Object.keys(dErr)[0];
  if (firstBad) return { ok: false, field: firstBad };

  const c = (r.consent ?? {}) as Record<string, unknown>;
  const consent = {
    training: bool(c.training),
    notDiagnosis: bool(c.notDiagnosis),
    ageOrGuardian: bool(c.ageOrGuardian),
    consentedAt: str(c.consentedAt, 40),
    version: c.version === CONSENT_VERSION ? CONSENT_VERSION : null,
  };
  for (const [k, v] of Object.entries(consent)) if (v === null) return { ok: false, field: `consent.${k}` };
  const full = consent as SubmissionPayload["consent"];
  const cErr = validateConsent(full);
  const firstC = Object.keys(cErr)[0];
  if (firstC) return { ok: false, field: `consent.${firstC}` };

  return { ok: true, value: { submissionKey: r.submissionKey, details, consent: full } };
}
