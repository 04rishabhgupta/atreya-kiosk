"use client";

import { createContext, useContext, useMemo, useReducer, useRef } from "react";
import type { ShotId } from "@/lib/config";
import { STRINGS, type Lang, type Strings } from "@/lib/strings";
import { emptyConsent, emptyDetails, isMinor, type Consent, type Details } from "@/lib/validate";

export const STEPS = { about: 0, dos: 1, camera: 2, details: 3, consent: 4, review: 5, success: 6 } as const;
export const STEP_COUNT = 7;

export interface Capture {
  blob: Blob;
  url: string;
}
export interface BlobRef {
  blob: Blob;
  url: string;
}

export interface SubmitState {
  status: "idle" | "sending" | "error";
  progress: number; // 0..1 upload progress; 1 = waiting for server
  error: string | null;
  locked: boolean; // an attempt may have reached the server: only Retry, no edits
}

export interface State {
  session: number;
  step: number;
  lang: Lang;
  fromReview: boolean;
  dosAccepted: boolean;
  details: Details;
  consent: Consent;
  consentedAt: string | null;
  captures: Partial<Record<ShotId, Capture>>;
  signature: BlobRef | null;
  video: BlobRef | null;
  submissionKey: string;
  submit: SubmitState;
  referenceId: string | null;
}

type Action =
  | { type: "lang"; lang: Lang }
  | { type: "go"; step: number; fromReview?: boolean }
  | { type: "next" }
  | { type: "back" }
  | { type: "dos"; value: boolean }
  | { type: "details"; patch: Partial<Details> }
  | { type: "consent"; patch: Partial<Consent> }
  | { type: "consentedAt"; at: string }
  | { type: "capture"; id: ShotId; capture: Capture | null }
  | { type: "signature"; value: BlobRef | null }
  | { type: "video"; value: BlobRef | null }
  | { type: "submit"; patch: Partial<SubmitState> }
  | { type: "submitted"; referenceId: string }
  | { type: "newKey" }
  | { type: "reset" };

export function newKey(): string {
  // randomUUID only exists in secure contexts; fall back to getRandomValues for LAN testing.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const idleSubmit: SubmitState = { status: "idle", progress: 0, error: null, locked: false };

function initial(session: number): State {
  return {
    session,
    step: STEPS.about,
    lang: "en",
    fromReview: false,
    dosAccepted: false,
    details: emptyDetails,
    consent: emptyConsent,
    consentedAt: null,
    captures: {},
    signature: null,
    video: null,
    submissionKey: newKey(),
    submit: idleSubmit,
    referenceId: null,
  };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "lang":
      return { ...s, lang: a.lang };
    case "go":
      return { ...s, step: a.step, fromReview: !!a.fromReview };
    case "next":
      // When editing from Review, "Continue" goes straight back to Review.
      return { ...s, step: s.fromReview ? STEPS.review : Math.min(s.step + 1, STEPS.success), fromReview: false };
    case "back":
      return { ...s, step: s.fromReview ? STEPS.review : Math.max(s.step - 1, 0), fromReview: false };
    case "dos":
      return { ...s, dosAccepted: a.value };
    case "details": {
      const details = { ...s.details, ...a.patch };
      // The age tick means "I am 18+" or "I am the guardian": clear it if that meaning flips.
      const flipped = isMinor(details.age) !== isMinor(s.details.age);
      return { ...s, details, consent: flipped ? { ...s.consent, ageOrGuardian: false } : s.consent };
    }
    case "consent":
      return { ...s, consent: { ...s.consent, ...a.patch } };
    case "consentedAt":
      return { ...s, consentedAt: a.at };
    case "capture":
      return { ...s, captures: { ...s.captures, [a.id]: a.capture ?? undefined } };
    case "signature":
      return { ...s, signature: a.value };
    case "video":
      return { ...s, video: a.value };
    case "submit":
      return { ...s, submit: { ...s.submit, ...a.patch } };
    case "submitted":
      return { ...s, referenceId: a.referenceId, submit: idleSubmit, step: STEPS.success };
    case "newKey":
      return { ...s, submissionKey: newKey() };
    case "reset":
      return initial(s.session + 1);
  }
}

function revokeAll(s: State) {
  for (const c of Object.values(s.captures)) if (c) URL.revokeObjectURL(c.url);
  if (s.signature) URL.revokeObjectURL(s.signature.url);
  if (s.video) URL.revokeObjectURL(s.video.url);
}

export interface Actions {
  dispatch: React.Dispatch<Action>;
  next(): void;
  back(): void;
  go(step: number, fromReview?: boolean): void;
  setCapture(id: ShotId, c: Capture | null): void;
  setSignature(blob: Blob | null): void;
  setVideo(blob: Blob | null): void;
  reset(): void;
}

const StateCtx = createContext<State | null>(null);
const ActionsCtx = createContext<Actions | null>(null);

export function KioskProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, 0, initial);
  const ref = useRef(state);
  ref.current = state;

  // Stable object: components that only dispatch never re-render on state changes.
  const actions = useMemo<Actions>(() => {
    const swapBlob = (old: BlobRef | null | undefined, blob: Blob | null): BlobRef | null => {
      if (old) URL.revokeObjectURL(old.url);
      return blob ? { blob, url: URL.createObjectURL(blob) } : null;
    };
    return {
      dispatch,
      next: () => dispatch({ type: "next" }),
      back: () => dispatch({ type: "back" }),
      go: (step, fromReview) => dispatch({ type: "go", step, fromReview }),
      setCapture(id, c) {
        const old = ref.current.captures[id];
        if (old && old.url !== c?.url) URL.revokeObjectURL(old.url);
        dispatch({ type: "capture", id, capture: c });
      },
      setSignature: (blob) => dispatch({ type: "signature", value: swapBlob(ref.current.signature, blob) }),
      setVideo: (blob) => dispatch({ type: "video", value: swapBlob(ref.current.video, blob) }),
      reset() {
        revokeAll(ref.current);
        dispatch({ type: "reset" });
      },
    };
  }, []);

  return (
    <ActionsCtx.Provider value={actions}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </ActionsCtx.Provider>
  );
}

export function useKiosk(): State {
  const s = useContext(StateCtx);
  if (!s) throw new Error("useKiosk outside KioskProvider");
  return s;
}
export function useActions(): Actions {
  const a = useContext(ActionsCtx);
  if (!a) throw new Error("useActions outside KioskProvider");
  return a;
}
export function useStrings(): Strings {
  return STRINGS[useKiosk().lang];
}
