// Cheap per-frame quality checks on a tiny downscaled crop. No ML libraries.
import { CHECKS, IMAGE } from "@/lib/config";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Oval {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Face oval in box pixels. Shared by the SVG overlay and the analysis mask so they always match. */
export function ovalFor(boxW: number, boxH: number): Oval {
  const w = Math.min(boxW * 0.64, boxH * 0.5);
  return { cx: boxW / 2, cy: boxH * 0.47, rx: w / 2, ry: (w * 1.3) / 2 };
}

/** The part of the video frame that `object-fit: cover` shows in a boxW x boxH element. */
export function coverCrop(vw: number, vh: number, boxW: number, boxH: number): Rect {
  const scale = Math.max(boxW / vw, boxH / vh);
  const w = boxW / scale;
  const h = boxH / scale;
  return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
}

export interface Metrics {
  brightness: number; // mean luma 0-255 inside the oval
  sharpness: number; // Laplacian variance inside the oval
  motion: number; // mean abs luma change since the previous check
}

export class FrameAnalyzer {
  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private mask = new Uint8Array(0);
  private gray = new Float32Array(0);
  private prev: Float32Array | null = null;
  private w = 0;
  private h = 0;

  constructor() {
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true, alpha: false });
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
  }

  /** Call when the on-screen box size changes. */
  resize(boxW: number, boxH: number) {
    const s = CHECKS.analysisLongEdge / Math.max(boxW, boxH);
    this.w = Math.max(8, Math.round(boxW * s));
    this.h = Math.max(8, Math.round(boxH * s));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    const o = ovalFor(this.w, this.h);
    this.mask = new Uint8Array(this.w * this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const dx = (x - o.cx) / o.rx;
        const dy = (y - o.cy) / o.ry;
        if (dx * dx + dy * dy <= 1) this.mask[y * this.w + x] = 1;
      }
    this.gray = new Float32Array(this.w * this.h);
    this.prev = null;
  }

  analyze(video: HTMLVideoElement, crop: Rect): Metrics {
    const { w, h, mask, gray } = this;
    this.ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
    const px = this.ctx.getImageData(0, 0, w, h).data;

    let sum = 0;
    let n = 0;
    let diff = 0;
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      const g = (77 * (px[p] ?? 0) + 150 * (px[p + 1] ?? 0) + 29 * (px[p + 2] ?? 0)) >> 8;
      gray[i] = g;
      if (mask[i]) {
        sum += g;
        n++;
        if (this.prev) diff += Math.abs(g - (this.prev[i] ?? g));
      }
    }

    // 4-neighbour Laplacian over interior oval pixels.
    let ls = 0;
    let ls2 = 0;
    let ln = 0;
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        const l = 4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - w]! - gray[i + w]!;
        ls += l;
        ls2 += l * l;
        ln++;
      }

    const hadPrev = !!this.prev;
    this.prev = this.prev ?? new Float32Array(w * h);
    this.prev.set(gray);

    const mean = ln ? ls / ln : 0;
    return {
      brightness: n ? sum / n : 0,
      sharpness: ln ? ls2 / ln - mean * mean : 0,
      motion: hadPrev && n ? diff / n : 0,
    };
  }
}

// ---- Optional FaceDetector (Shape Detection API). Never required. ----

interface DetectedFace {
  boundingBox: DOMRectReadOnly;
}
interface FaceDetectorLike {
  detect(src: CanvasImageSource): Promise<DetectedFace[]>;
}
type FaceDetectorCtor = new (o?: { maxDetectedFaces?: number; fastMode?: boolean }) => FaceDetectorLike;

export function createFaceDetector(): FaceDetectorLike | null {
  const Ctor = (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ maxDetectedFaces: 2, fastMode: true });
  } catch {
    return null;
  }
}

/** Face boxes converted from video pixels into on-screen box pixels. */
export interface FaceResult {
  count: number;
  box: Rect | null;
}

export function toBoxCoords(faces: DetectedFace[], crop: Rect, boxW: number): FaceResult {
  const f = faces[0];
  if (!f) return { count: 0, box: null };
  const s = boxW / crop.w;
  const b = f.boundingBox;
  return { count: faces.length, box: { x: (b.x - crop.x) * s, y: (b.y - crop.y) * s, w: b.width * s, h: b.height * s } };
}

// ---- Turning metrics into one prompt ----

export type Guidance =
  | "starting"
  | "tooDark"
  | "tooBright"
  | "noFace"
  | "multipleFaces"
  | "moveCloser"
  | "moveBack"
  | "centre"
  | "holdStill"
  | "good";
export type Level = "bad" | "warn" | "good";

export function evaluate(m: Metrics, face: FaceResult | null, oval: Oval): { g: Guidance; level: Level } {
  if (m.brightness < CHECKS.brightnessMin) return { g: "tooDark", level: "bad" };
  if (m.brightness > CHECKS.brightnessMax) return { g: "tooBright", level: "bad" };
  if (face) {
    if (face.count === 0 || !face.box) return { g: "noFace", level: "bad" };
    if (face.count > 1) return { g: "multipleFaces", level: "bad" };
    const ratio = face.box.w / (oval.rx * 2);
    if (ratio < CHECKS.faceMinWidth) return { g: "moveCloser", level: "warn" };
    if (ratio > CHECKS.faceMaxWidth) return { g: "moveBack", level: "warn" };
    const fx = face.box.x + face.box.w / 2;
    const fy = face.box.y + face.box.h / 2;
    const tol = CHECKS.faceCentreTolerance * oval.rx * 2;
    if (Math.abs(fx - oval.cx) > tol || Math.abs(fy - oval.cy) > tol) return { g: "centre", level: "warn" };
  }
  if (m.motion > CHECKS.motionMax || m.sharpness < CHECKS.sharpnessMin) return { g: "holdStill", level: "warn" };
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
