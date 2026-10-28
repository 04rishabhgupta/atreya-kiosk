// Single place for every tunable. Shared by client and server, so no secrets here.

// 1.1: single combined consent checkbox, no signature. Bump again whenever the consent text changes.
export const CONSENT_VERSION = "ATR-CONSENT-1.1-2026-10";
// TODO before go-live: replace with a monitored inbox. Shown on the consent screen as the withdrawal route.
export const CONTACT_EMAIL = "privacy@your-domain.example";
export const RETENTION_YEARS = 5;

// ---- Flow behaviour ----
export const IDLE_TIMEOUT_MS = 90_000;
export const IDLE_COUNTDOWN_S = 10;
export const SUCCESS_RESET_S = 15;

// ---- Camera ----
// Off: with no positioning checks, "every check passes" happens the moment a well-lit face appears, which is
// too early (participants are still settling or removing glasses). They tap Capture when ready instead.
export const AUTO_CAPTURE = false;

// Self-hosted MediaPipe face detector (BlazeFace short-range). The runtime is copied into
// public/mediapipe/wasm-<version> by scripts/copy-mediapipe.mjs, which checks this matches package.json.
export const MEDIAPIPE_VERSION = "1.1.1";
export const FACE_DETECTOR = {
  wasmBase: `/mediapipe/wasm-${MEDIAPIPE_VERSION}`,
  model: "/mediapipe/blaze_face_short_range-f16-v1.tflite",
  minConfidence: 0.5, // detections below this are ignored entirely (also when counting people)
} as const;
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 960 },
    frameRate: { ideal: 24, max: 30 },
  },
};

export const IMAGE = {
  maxEdge: 1280,
  quality: 0.85,
  fallbackQuality: 0.72, // used once if the first export is over targetBytes
  targetBytes: 400_000,
} as const;

export const CHECKS = {
  intervalMs: 250, // ~4 checks per second
  faceIntervalMs: 333, // face detection is pricier: ~3 per second
  analysisLongEdge: 160,
  // Lighting is measured on the detected face (not on a fixed region), so it works wherever the face is.
  brightnessMin: 70, // mean luma 0-255 on the face
  brightnessMax: 205,
  overexposedMax: 0.06, // max fraction of face pixels that are blown out (luma >= 248)
  sideShadowMax: 0.3, // front shot: max left/right brightness imbalance, as a fraction of the brighter half
  goodHoldMs: 1_000, // auto-capture only (see AUTO_CAPTURE)
  frontScoreMin: 0.7, // front shot: detector confidence needed for "face clearly visible"
  profileScoreMin: 0.5, // turned shots: the detector is naturally less sure on a 45-degree profile
} as const;

export type ShotId = "front" | "left" | "right";
export interface ShotConfig {
  id: ShotId;
  column: string; // sheet column header
  fileName: string; // Drive file name
  // Which way the participant turns their head. "Left" = left side of the face shown,
  // so they turn to their right. Flip here if your protocol defines it the other way.
  // Also selects the checks: "none" = front (stricter confidence, side-shadow check);
  // turned shots use the profile confidence threshold. The turn itself is guided, not enforced.
  turn: "none" | "left" | "right";
}

export const SHOTS: ShotConfig[] = [
  { id: "front", column: "Facial Image - Front", fileName: "front.jpg", turn: "none" },
  { id: "left", column: "Facial Image - Left", fileName: "left.jpg", turn: "right" },
  { id: "right", column: "Facial Image - Right", fileName: "right.jpg", turn: "left" },
];

// Optional rPPG clip. Keep bitrate x seconds well under the 4 MB request cap (images take ~1.2 MB).
export const ENABLE_VIDEO = false;
export const VIDEO = {
  seconds: 20,
  bitsPerSecond: 800_000,
  maxBytes: 2_300_000, // recording stops early if it reaches this
} as const;

// ---- Form ----
export interface Option {
  value: string; // stored in the sheet (English)
  en: string;
  hi: string;
}

export const DIABETIC_CATEGORIES: Option[] = [
  { value: "Non-Diabetic", en: "Non-diabetic", hi: "मधुमेह नहीं" },
  { value: "Pre-Diabetic", en: "Pre-diabetic", hi: "प्री-डायबिटिक" },
  { value: "Type 1 Diabetes", en: "Type 1 diabetes", hi: "टाइप 1 मधुमेह" },
  { value: "Type 2 Diabetes", en: "Type 2 diabetes", hi: "टाइप 2 मधुमेह" },
  { value: "Gestational Diabetes", en: "Gestational diabetes", hi: "गर्भावधि मधुमेह" },
  { value: "Unknown", en: "Don't know", hi: "पता नहीं" },
];

export const GENDERS: Option[] = [
  { value: "Male", en: "Male", hi: "पुरुष" },
  { value: "Female", en: "Female", hi: "महिला" },
  { value: "Other", en: "Other", hi: "अन्य" },
];

// The existing sheet has an unnamed column I between HbA1c and RBS. We assume it is fasting
// blood sugar. Set to null to hide the field; the cell is then written empty so columns never shift.
export const COLUMN_I: { header: string; en: string; hi: string; min: number; max: number } | null = {
  header: "FBS (mg/dL)",
  en: "Fasting blood sugar (mg/dL)",
  hi: "फास्टिंग ब्लड शुगर (mg/dL)",
  min: 20,
  max: 800,
};

export const RANGES = {
  age: [1, 120],
  heightCm: [30, 250],
  weightKg: [2, 300],
  hba1c: [3, 20],
  rbs: [20, 800],
} as const;

export const LIMITS = {
  maxRequestBytes: 4 * 1024 * 1024, // under Vercel's 4.5 MB body limit
  maxImageBytes: 1_200_000,
  maxSignatureBytes: 200_000,
  maxDataJsonBytes: 20_000,
  nameMax: 80,
  medicineMax: 300,
  rateLimitPerMinute: 10,
} as const;

// ---- Google Sheet layout ----
export const SHEET_TAB = "Form_Responses";

// Order is fixed: existing columns A-N first, then new columns. Only ever append to the end.
export const SHEET_COLUMNS: string[] = [
  "Timestamp",
  "Patient Name",
  "Age",
  "Gender",
  "Height (cm)",
  "Weight (kgs)",
  "Diabetic Category",
  "HbA1c",
  COLUMN_I?.header ?? "Column I",
  "RBS",
  "Currently taking any Medicine?",
  ...SHOTS.map((s) => s.column),
  "Reference ID",
  "Submission ID",
  "Drive Folder Link",
  "Consent Version",
  "Consent Timestamp",
  "Signature Link",
  ...(ENABLE_VIDEO ? ["Face Video"] : []),
];
