"use client";

import { memo, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { AUTO_CAPTURE, CAMERA_CONSTRAINTS, CHECKS } from "@/lib/config";
import type { Strings } from "@/lib/strings";
import {
  coverCrop,
  createFaceDetector,
  evaluate,
  FrameAnalyzer,
  grabStill,
  ovalFor,
  toBoxCoords,
  type FaceResult,
  type Guidance,
  type Level,
  type Metrics,
} from "./checks";
import { FaceOverlay } from "./FaceOverlay";

export type CameraError = "denied" | "missing" | "busy" | "insecure" | "error";

export interface CameraHandle {
  grab(): Promise<{ blob: Blob; width: number; height: number }>;
  stream(): MediaStream | null;
}

interface Props {
  ref: Ref<CameraHandle>;
  turn: "none" | "left" | "right";
  faceCheck: boolean;
  active: boolean; // false while counting down / reviewing: checks pause, camera stays open
  guide: Strings["guide"];
  onError: (e: CameraError) => void;
  onAutoCapture: () => void;
}

function classify(e: unknown): CameraError {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "error";
}

/**
 * Live preview + check loop. The loop runs on a timer outside React; it only calls setState
 * when the prompt actually changes, so the component re-renders a few times per shot at most.
 */
export const CameraView = memo(function CameraView({ ref, turn, faceCheck, active, guide, onError, onAutoCapture }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [state, setState] = useState<{ g: Guidance; level: Level }>({ g: "starting", level: "bad" });

  // Everything the timer reads lives in refs.
  const live = useRef({
    active,
    faceCheck,
    metrics: { brightness: 0, sharpness: 0, motion: 0 } as Metrics,
    face: null as FaceResult | null,
    detector: undefined as ReturnType<typeof createFaceDetector> | undefined,
    goodSince: 0,
    autoFired: false,
    last: "starting" as Guidance,
    size: { w: 0, h: 0 },
  });
  const cb = useRef({ onError, onAutoCapture });
  cb.current = { onError, onAutoCapture };

  useEffect(() => {
    const l = live.current;
    l.active = active;
    l.faceCheck = faceCheck;
    l.goodSince = 0;
    l.autoFired = false;
    l.face = null;
  }, [active, faceCheck]);

  useImperativeHandle(ref, () => ({
    async grab() {
      const v = video.current;
      if (!v || !v.videoWidth) throw new Error("not ready");
      return grabStill(v);
    },
    stream: () => streamRef.current,
  }));

  // Camera lifecycle: open on mount, stop every track on unmount.
  useEffect(() => {
    let cancelled = false;
    const open = async () => {
      if (!window.isSecureContext) return cb.current.onError("insecure");
      if (!navigator.mediaDevices?.getUserMedia) return cb.current.onError("missing");
      try {
        const s = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        streamRef.current = s;
        const v = video.current;
        if (!v) return;
        v.srcObject = s;
        await v.play().catch(() => undefined);
      } catch (e) {
        if (!cancelled) cb.current.onError(classify(e));
      }
    };
    void open();

    // Some devices end the track when the tab is backgrounded; reopen when we come back.
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track || track.readyState === "ended") {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        void open();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (video.current) video.current.srcObject = null;
    };
  }, []);

  // Track the box size (overlay + analysis mask depend on it).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      const s = { w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) };
      live.current.size = s;
      setSize(s);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The check loop: ~4 Hz pixels, ~2 Hz face detection, paused when hidden.
  useEffect(() => {
    const l = live.current;
    let analyzer: FrameAnalyzer | null = null;
    let sizedFor = "";
    let lastFace = 0;
    let faceBusy = false;
    let timer: number | undefined;

    const tick = () => {
      const v = video.current;
      const { w, h } = l.size;
      if (!l.active || !v || v.readyState < 2 || !v.videoWidth || !w || !h) return;
      analyzer ??= new FrameAnalyzer();
      if (sizedFor !== `${w}x${h}`) {
        analyzer.resize(w, h);
        sizedFor = `${w}x${h}`;
      }
      const crop = coverCrop(v.videoWidth, v.videoHeight, w, h);
      l.metrics = analyzer.analyze(v, crop);

      if (l.faceCheck) {
        if (l.detector === undefined) l.detector = createFaceDetector();
        const now = performance.now();
        if (l.detector && !faceBusy && now - lastFace >= CHECKS.faceIntervalMs) {
          faceBusy = true;
          lastFace = now;
          l.detector
            .detect(v)
            .then((faces) => (l.face = toBoxCoords(faces, crop, w)))
            .catch(() => {
              l.detector = null; // exists but unsupported here: skip silently from now on
              l.face = null;
            })
            .finally(() => (faceBusy = false));
        }
      }

      const faceOn = l.faceCheck && !!l.detector;
      const r = evaluate(l.metrics, faceOn ? l.face ?? { count: 0, box: null } : null, ovalFor(w, h));
      if (r.g !== l.last) {
        l.last = r.g;
        setState(r);
      }

      // Auto-capture only when a face detector actually confirms a face.
      if (r.level === "good" && AUTO_CAPTURE && faceOn) {
        const now = performance.now();
        if (!l.goodSince) l.goodSince = now;
        if (!l.autoFired && now - l.goodSince >= CHECKS.goodHoldMs) {
          l.autoFired = true;
          cb.current.onAutoCapture();
        }
      } else {
        l.goodSince = 0;
      }
    };

    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(tick, CHECKS.intervalMs);
    };
    const onVis = () => (document.visibilityState === "visible" ? start() : window.clearInterval(timer));
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const autoReady = state.level === "good" && AUTO_CAPTURE && faceCheck && live.current.detector;
  const message = active ? (autoReady ? guide.goodAuto : guide[state.g]) : "";

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden bg-ink">
      <video ref={video} className="mirror absolute inset-0 h-full w-full object-cover" playsInline muted autoPlay />
      {active && <FaceOverlay w={size.w} h={size.h} level={state.level} turn={turn} />}
      {message && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
          <p
            aria-live="polite"
            className={`rounded-full px-6 py-3 text-center text-[22px] font-semibold text-white ${
              state.level === "good" ? "bg-good" : state.level === "warn" ? "bg-warn" : "bg-bad"
            }`}
          >
            {message}
          </p>
        </div>
      )}
    </div>
  );
});
