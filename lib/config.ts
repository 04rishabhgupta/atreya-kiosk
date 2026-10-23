// Single place for every tunable. Shared by client and server, so no secrets here.

export const CONSENT_VERSION = "ATR-CONSENT-1.0-2026-10";
// TODO before go-live: replace with a monitored inbox. Shown on the consent screen as the withdrawal route.
export const CONTACT_EMAIL = "privacy@your-domain.example";
export const RETENTION_YEARS = 5;

// ---- Flow behaviour ----
export const IDLE_TIMEOUT_MS = 90_000;
export const IDLE_COUNTDOWN_S = 10;
export const SUCCESS_RESET_S = 15;
export const ABOUT_AUTO_ADVANCE_MS = 6_000;

// ---- Camera ----
export const AUTO_CAPTURE = true; // only fires when FaceDetector is available for that shot
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
  faceIntervalMs: 500, // FaceDetector is pricier: ~2 per second
  analysisLongEdge: 160,
  brightnessMin: 70, // mean luma 0-255 inside the oval
  brightnessMax: 205,
  sharpnessMin: 18, // Laplacian variance on the 160px crop
  motionMax: 10, // mean abs frame difference
  goodHoldMs: 1_000,
  faceMinWidth: 0.4, // face width as a fraction of oval width
  faceMaxWidth: 1.15,
  faceCentreTolerance: 0.25, // allowed face-centre offset, as a fraction of oval width
} as const;

export type ShotId = "front" | "left" | "right";
export interface ShotConfig {
  id: ShotId;
  column: string; // sheet column header
  fileName: string; // Drive file name
  // Which way the participant turns their head. "Left" = left side of the face shown,
  // so they turn to their right. Flip here if your protocol defines it the other way.
  turn: "none" | "left" | "right";
  faceCheck: boolean; // FaceDetector is unreliable on 45° profiles, so only check the front
}

export const SHOTS: ShotConfig[] = [
  { id: "front", column: "Facial Image - Front", fileName: "front.jpg", turn: "none", faceCheck: true },
  { id: "left", column: "Facial Image - Left", fileName: "left.jpg", turn: "right", faceCheck: false },
  { id: "right", column: "Facial Image - Right", fileName: "right.jpg", turn: "left", faceCheck: false },
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
