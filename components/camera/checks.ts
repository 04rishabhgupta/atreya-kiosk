// Camera geometry and still capture. There are no automatic quality checks: nothing here can block a photo.
import { IMAGE } from "@/lib/config";

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
