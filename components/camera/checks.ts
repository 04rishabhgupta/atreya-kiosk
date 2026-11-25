// Camera geometry and still capture. There are no automatic quality checks: nothing here can block a photo.
import { IMAGE, PREVIEW } from "@/lib/config";

export interface Oval {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/**
 * Face-guide oval in box pixels: a generous target that fills nearly all of the preview's width or height.
 * `bandH` is how tall the saved photo appears in the box (see savedBandHeight); the oval stays within ~73%
 * of it so a face that fills the oval keeps its hair and chin in the photo (only binds on portrait phones).
 */
export function ovalFor(boxW: number, boxH: number, bandH = Infinity): Oval {
  const rx = Math.min(boxW * 0.48, boxH * 0.365, bandH * 0.28);
  return { cx: boxW / 2, cy: boxH * 0.5, rx, ry: rx * 1.3 };
}

/**
 * Zoom for the live preview (object-fit: cover in a boxW x boxH box, camera frame vw x vh). Wide boxes zoom
 * in so the face fills more of the oval. The zoom is also never less than what keeps the visible area inside
 * the 16:9 region that grabStill saves, so nothing seen in the preview is missing from the photo (matters for
 * portrait phone cameras, where the saved 16:9 photo is a band across the middle of the frame).
 */
export function previewZoom(boxW: number, boxH: number, vw: number, vh: number): number {
  if (!boxW || !boxH || !vw || !vh) return 1;
  const t = Math.min(1, Math.max(0, (boxW / boxH - PREVIEW.fromAspect) / (PREVIEW.toAspect - PREVIEW.fromAspect)));
  const wanted = 1 + (PREVIEW.maxZoom - 1) * t;
  const cover = Math.max(boxW / vw, boxH / vh);
  const saved = cropTo(vw, vh, IMAGE.width / IMAGE.height);
  const fit = Math.max(boxW / cover / saved.w, boxH / cover / saved.h);
  return Math.max(1, wanted, fit);
}

/** On-screen height (box pixels) of the region grabStill saves, at the given preview zoom. */
export function savedBandHeight(boxW: number, boxH: number, vw: number, vh: number, zoom: number): number {
  if (!boxW || !boxH || !vw || !vh) return Infinity;
  return cropTo(vw, vh, IMAGE.width / IMAGE.height).h * Math.max(boxW / vw, boxH / vh) * zoom;
}

// ---- Still capture ----

/** Centre crop of a vw x vh frame with the target aspect ratio (crops, never stretches). */
export function cropTo(vw: number, vh: number, aspect: number): { x: number; y: number; w: number; h: number } {
  if (vw / vh > aspect) {
    const w = vh * aspect;
    return { x: (vw - w) / 2, y: 0, w, h: vh };
  }
  const h = vw / aspect;
  return { x: 0, y: (vh - h) / 2, w: vw, h };
}

/**
 * The final photo: exactly IMAGE.width x IMAGE.height (1920x1080), lossless PNG, un-mirrored. A 1920x1080
 * camera frame (the normal case, see FULL_HD_CONSTRAINTS) is copied pixel for pixel: no crop, no scaling,
 * no smoothing. Only in the fallback (no Full HD camera) is the frame centre-cropped to 16:9 and scaled.
 */
export async function grabStill(video: HTMLVideoElement): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height, mime } = IMAGE;
  const native = video.videoWidth === width && video.videoHeight === height;
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const g = c.getContext("2d", { alpha: false });
  if (!g) throw new Error("no 2d context");
  if (native) {
    g.imageSmoothingEnabled = false;
    g.drawImage(video, 0, 0);
  } else {
    console.warn(`camera frame is ${video.videoWidth}x${video.videoHeight}, not ${width}x${height}: photo is scaled`);
    const src = cropTo(video.videoWidth, video.videoHeight, width / height);
    g.imageSmoothingQuality = "high";
    g.drawImage(video, src.x, src.y, src.w, src.h, 0, 0, width, height);
  }
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), mime));
  c.width = c.height = 0; // free the backing store now on low-RAM devices
  return { blob, width, height };
}
