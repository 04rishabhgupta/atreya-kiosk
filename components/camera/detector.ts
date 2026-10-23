// Self-hosted MediaPipe face detector (BlazeFace short-range, CPU). One instance per page load:
// it is created on first use (or warmed from the Instructions step) and reused for every shot and
// participant, so the ~4 MB runtime is fetched and compiled once. The library itself is a separate
// lazy chunk, so nothing here is downloaded before the camera flow starts.
import { FACE_DETECTOR } from "@/lib/config";
import type { RawFace } from "./checks";

export interface Detector {
  detect(video: HTMLVideoElement, nowMs: number): RawFace[];
}

let pending: Promise<Detector> | null = null;

export function loadFaceDetector(): Promise<Detector> {
  pending ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks(FACE_DETECTOR.wasmBase);
    const fd = await FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: FACE_DETECTOR.model, delegate: "CPU" },
      runningMode: "VIDEO",
      minDetectionConfidence: FACE_DETECTOR.minConfidence,
    });
    let last = 0;
    return {
      detect(video, nowMs) {
        // VIDEO mode requires strictly increasing timestamps.
        last = Math.max(nowMs, last + 1);
        return fd.detectForVideo(video, last).detections.flatMap((d) =>
          d.boundingBox ? [{ score: d.categories[0]?.score ?? 0, box: d.boundingBox }] : [],
        );
      },
    };
  })();
  // A failed load (offline, unsupported device) may be retried later, e.g. via the camera's Try again.
  pending.catch(() => (pending = null));
  return pending;
}
