// Per-frame quality checks: the face detector's result (components/camera/detector.ts) plus cheap pixel
// statistics measured on the detected face itself, combined into one prompt for the participant.
// Deliberately no distance, oval-positioning or head-turn checks: the oval is a visual guide only.
import { CHECKS, IMAGE, type ShotConfig } from "@/lib/config";

export interface Oval {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Face-guide oval in box pixels: a generous, comfortable target that nearly fills the preview width. */
export function ovalFor(boxW: number, boxH: number): Oval {
  const rx = Math.min(boxW * 0.47, boxH * 0.34);
  return { cx: boxW / 2, cy: boxH * 0.47, rx, ry: rx * 1.3 };
}

/** A face as reported by the detector, in video pixels. */
export interface RawFace {
  score: number;
  box: { originX: number; originY: number; width: number; height: number };
}

export interface FaceResult {
  count: number; // confident faces anywhere in the camera frame (the whole frame is what gets saved)
  score: number; // confidence of the main (largest) face
  box: RawFace["box"] | null;
}

export function toFaceResult(faces: RawFace[]): FaceResult {
  const f = faces.reduce<RawFace | undefined>((a, b) => (!a || b.box.width > a.box.width ? b : a), undefined);
  return f ? { count: faces.length, score: f.score, box: f.box } : { count: 0, score: 0, box: null };
}

export interface Metrics {
  frame: number; // mean luma 0-255 of the whole frame (used when no face is found)
  face: { brightness: number; overexposed: number; sideImbalance: number } | null; // on the main face
}

const BLOWN_OUT = 248;

/** Lighting statistics on a tiny downscaled copy of the frame (~160 px long edge). */
export class FrameAnalyzer {
  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private sizedFor = "";

  constructor() {
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true, alpha: false });
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
  }

  analyze(video: HTMLVideoElement, face: RawFace["box"] | null): Metrics {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const s = CHECKS.analysisLongEdge / Math.max(vw, vh);
    const w = Math.max(8, Math.round(vw * s));
    const h = Math.max(8, Math.round(vh * s));
    if (this.sizedFor !== `${w}x${h}`) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.sizedFor = `${w}x${h}`;
    }
    this.ctx.drawImage(video, 0, 0, w, h);
    const px = this.ctx.getImageData(0, 0, w, h).data;
    const luma = (i: number) => (77 * (px[i] ?? 0) + 150 * (px[i + 1] ?? 0) + 29 * (px[i + 2] ?? 0)) >> 8;

    let all = 0;
    for (let i = 0; i < px.length; i += 4) all += luma(i);
    const frame = all / (w * h);
    if (!face) return { frame, face: null };

    // Ellipse inscribed in the face box, so background in the box corners doesn't count; split at its centre.
    const cx = (face.originX + face.width / 2) * s;
    const cy = (face.originY + face.height / 2) * s;
    const rx = (face.width / 2) * s;
    const ry = (face.height / 2) * s;
    let n = 0;
    let blown = 0;
    const sum = [0, 0];
    const cnt = [0, 0];
    for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(h, Math.ceil(cy + ry)); y++)
      for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(w, Math.ceil(cx + rx)); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const g = luma((y * w + x) * 4);
        const side = x < cx ? 0 : 1;
        sum[side]! += g;
        cnt[side]!++;
        n++;
        if (g >= BLOWN_OUT) blown++;
      }
    if (!n) return { frame, face: null };
    const left = cnt[0] ? sum[0]! / cnt[0]! : 0;
    const right = cnt[1] ? sum[1]! / cnt[1]! : 0;
    const hi = Math.max(left, right);
    return {
      frame,
      face: { brightness: (sum[0]! + sum[1]!) / n, overexposed: blown / n, sideImbalance: hi > 0 ? Math.abs(left - right) / hi : 0 },
    };
  }
}

// ---- Turning metrics into one prompt ----

export type Guidance =
  | "starting"
  | "checking"
  | "detectorFailed"
  | "noFace"
  | "multipleFaces"
  | "faceNotClear"
  | "tooDark"
  | "tooBright"
  | "overexposed"
  | "unevenLight"
  | "good";
export type Level = "bad" | "warn" | "good";
export type DetectorState = "loading" | "ready" | "failed";

/**
 * The only checks that block Capture: a clearly visible face, exactly one person, and even lighting.
 * There is deliberately no path to "good" without a working detector and a detected face.
 */
export function evaluate(m: Metrics, face: FaceResult | null, detector: DetectorState, turn: ShotConfig["turn"]): { g: Guidance; level: Level } {
  if (detector === "failed") return { g: "detectorFailed", level: "bad" };
  if (detector === "loading" || !face) return { g: "checking", level: "warn" };
  if (face.count === 0) {
    // A very dark or washed-out picture is the usual reason no face is found: say so.
    if (m.frame < CHECKS.brightnessMin) return { g: "tooDark", level: "bad" };
    if (m.frame > CHECKS.brightnessMax) return { g: "tooBright", level: "bad" };
    return { g: "noFace", level: "bad" };
  }
  if (face.count > 1) return { g: "multipleFaces", level: "bad" };
  const front = turn === "none";
  if (face.score < (front ? CHECKS.frontScoreMin : CHECKS.profileScoreMin)) return { g: "faceNotClear", level: "bad" };

  const f = m.face;
  if (!f) return { g: "checking", level: "warn" }; // face found but not yet measured (stats lag detection slightly)
  if (f.brightness < CHECKS.brightnessMin) return { g: "tooDark", level: "bad" };
  if (f.brightness > CHECKS.brightnessMax) return { g: "tooBright", level: "bad" };
  if (f.overexposed > CHECKS.overexposedMax) return { g: "overexposed", level: "bad" };
  // A turned face is naturally lit unevenly, so the side-shadow check only applies to the front shot.
  if (front && f.sideImbalance > CHECKS.sideShadowMax) return { g: "unevenLight", level: "warn" };
  return { g: "good", level: "good" };
}

// ---- Still capture ----

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", q));

/** Full, un-mirrored frame; long edge <= 1280; JPEG 0.85 (one fallback step if oversized). */
export async function grabStill(video: HTMLVideoElement): Promise<{ blob: Blob; width: number; height: number }> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const s = Math.min(1, IMAGE.maxEdge / Math.max(vw, vh));
  const c = document.createElement("canvas");
  c.width = Math.round(vw * s);
  c.height = Math.round(vh * s);
  c.getContext("2d", { alpha: false })?.drawImage(video, 0, 0, c.width, c.height);
  let blob = await toBlob(c, IMAGE.quality);
  if (blob.size > IMAGE.targetBytes) blob = await toBlob(c, IMAGE.fallbackQuality);
  c.width = c.height = 0; // free the backing store now on low-RAM devices
  return { blob, width: Math.round(vw * s), height: Math.round(vh * s) };
}
