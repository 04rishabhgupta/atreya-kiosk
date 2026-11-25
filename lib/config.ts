// Single place for every tunable. Shared by client and server, so no secrets here.

// 1.1: single combined consent checkbox, no signature.
// 1.2: no personal details (name, age, gender, height, weight) and no age/guardian statement.
// 1.3: the withdrawal ID is called "Subject ID" (was "Reference ID").
// 1.4: age and gender collected again, with the 18+ / parent-or-guardian statement.
// Bump again whenever the consent text changes.
export const CONSENT_VERSION = "ATR-CONSENT-1.4-2026-10";
// TODO before go-live: replace with a monitored inbox. Shown on the consent screen as the withdrawal route.
export const CONTACT_EMAIL = "privacy@your-domain.example";
export const RETENTION_YEARS = 5;

// ---- Flow behaviour ----
export const IDLE_TIMEOUT_MS = 90_000;
export const IDLE_COUNTDOWN_S = 10;
export const SUCCESS_RESET_S = 15;
// Long-running kiosks: reload the page (clearing any slow memory growth) once it is this old,
// only on the welcome screen after this long without a touch, and only if the server is reachable.
export const RELOAD_AFTER_MS = 4 * 3600_000;
export const RELOAD_QUIET_MS = 60_000;

// ---- Camera ----
// Tap Capture, then this many seconds (shown 5-4-3-2-1) to get into position before the photo is taken.
export const COUNTDOWN_S = 5;

// First choice: the camera's own 1920x1080 mode, required (exact), so the browser can't quietly settle for a
// smaller mode or another camera. getUserMedia picks whichever connected camera can do it (the kiosk's
// Logitech C920). resizeMode "none" = real sensor frames, never scaled by the browser. No frame-rate cap: the
// C920 only offers some rates at 1080p, and a cap could rule its 1080p modes out.
export const FULL_HD_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    width: { exact: 1920 },
    height: { exact: 1080 },
    frameRate: { ideal: 30 },
    resizeMode: { exact: "none" },
  } as MediaTrackConstraints, // resizeMode is missing from TypeScript's DOM types
};

// If several cameras can do 1080p (e.g. a laptop's own webcam too), use the kiosk's Logitech
// ("HD Pro Webcam C920 (046d:082d)" on Windows; 046d is Logitech's USB vendor ID).
export const PREFERRED_CAMERA = /c920|logitech|046d:/i;

// Fallback only, when no connected camera has a 1920x1080 mode: open the best the camera offers rather than
// no camera at all. Photos are then scaled up to 1920x1080 and the console and ?perf=1 say so.
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: "user",
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    aspectRatio: { ideal: 16 / 9 },
    frameRate: { ideal: 24, max: 24 }, // smooth enough for a preview; less decoding work on slow devices
  },
};

// Focus, exposure and white balance run on auto for this long after the camera opens, then are locked at the
// values they settled on, so all three photos are taken with the same settings.
export const CAMERA_SETTLE_MS = 2000;

// Every final photo: exactly this size, 16:9, lossless PNG. A 1920x1080 camera frame is saved as is, pixel for
// pixel. A realistic photo is ~3.5 MB, so photos are uploaded on their own (see LIMITS).
export const IMAGE = {
  width: 1920,
  height: 1080,
  mime: "image/png",
} as const;

// Live preview only (the saved photo is always the full 16:9 frame): zoom in on wide preview boxes so the face
// fills more of the oval. 1 = none on tall portrait boxes, up to maxZoom on landscape (desktop) boxes.
export const PREVIEW = {
  maxZoom: 1.35,
  fromAspect: 0.6, // box width / height at or below which there is no zoom
  toAspect: 1.3, // ... at or above which the zoom is maxZoom
} as const;

export type ShotId = "front" | "left" | "right";
export interface ShotConfig {
  id: ShotId;
  column: string; // sheet column header
  fileName: string; // Drive file name
  // Which way the participant turns their head. "Left" = left side of the face shown,
  // so they turn to their right. Flip here if your protocol defines it the other way.
  // The turn is shown as guidance (instruction + arrow) only; it is never checked.
  turn: "none" | "left" | "right";
}

export const SHOTS: ShotConfig[] = [
  { id: "front", column: "Facial Image - Front", fileName: "front.png", turn: "none" },
  { id: "left", column: "Facial Image - Left", fileName: "left.png", turn: "right" },
  { id: "right", column: "Facial Image - Right", fileName: "right.png", turn: "left" },
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

// Under this age the consent statement becomes "I am the parent or legal guardian...".
export const ADULT_AGE = 18;

// Optional fasting blood sugar field. Set to null to hide the field and drop its sheet column.
export const COLUMN_I: { header: string; en: string; hi: string; min: number; max: number } | null = {
  header: "FBS (mg/dL)",
  en: "Fasting blood sugar (mg/dL)",
  hi: "फास्टिंग ब्लड शुगर (mg/dL)",
  min: 20,
  max: 800,
};

export const RANGES = {
  age: [1, 120],
  hba1c: [3, 20],
  rbs: [20, 800],
} as const;

export const LIMITS = {
  maxRequestBytes: 4 * 1024 * 1024, // under Vercel's 4.5 MB body limit
  maxImageBytes: 1_200_000, // legacy JPEG photos sent inside the submit request by older kiosk pages
  // PNG photos go to /api/submit/photo one piece per request, each under Vercel's 4.5 MB request limit.
  photoPartBytes: 4_000_000,
  maxPhotoBytes: 12_000_000, // hard ceiling: even an incompressible 1920x1080 RGBA PNG is ~8.3 MB (3 pieces)
  rateLimitPhotoPartsPerMinute: 60,
  maxDataJsonBytes: 20_000,
  medicineMax: 300,
  rateLimitPerMinute: 10,
} as const;

/** Most pieces one photo can arrive in (3 with the values above). */
export const MAX_PHOTO_PARTS = Math.ceil(LIMITS.maxPhotoBytes / LIMITS.photoPartBytes);

// ---- Google Sheet layout ----
export const SHEET_TAB = "Form_Responses";

// Only what the kiosk collects, in the order a new sheet gets them. The script places values by header
// name, so an existing sheet keeps its own column order; headers it lacks are added at its end.
export const SHEET_COLUMNS: string[] = [
  "Timestamp",
  "Subject ID", // also the dedupe key: the script never writes two rows with one Subject ID
  "Age",
  "Gender",
  "Diabetic Category",
  "HbA1c",
  ...(COLUMN_I ? [COLUMN_I.header] : []),
  "RBS",
  "Currently taking any Medicine?",
  ...SHOTS.map((s) => s.column),
  "Drive Folder Link",
  "Consent Version",
  "Consent Timestamp",
  ...(ENABLE_VIDEO ? ["Face Video"] : []),
];
