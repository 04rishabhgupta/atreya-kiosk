"use client";

import { memo, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { CAMERA_CONSTRAINTS, CHECKS } from "@/lib/config";
import type { Strings } from "@/lib/strings";
import { evaluate, FrameAnalyzer, grabStill, toFaceResult, type DetectorState, type FaceResult, type Guidance, type Level, type Metrics } from "./checks";
import { loadFaceDetector, type Detector } from "./detector";
import { FaceOverlay } from "./FaceOverlay";

export type CameraError = "denied" | "missing" | "busy" | "insecure" | "error";

export interface CameraHandle {
  grab(): Promise<{ blob: Blob; width: number; height: number }>;
  stream(): MediaStream | null;
}

interface Props {
  ref: Ref<CameraHandle>;
  turn: "none" | "left" | "right";
  active: boolean; // checks run (live + countdown); false while reviewing: checks pause, camera stays open
  showGuidance: boolean; // the prompt pill (hidden during the countdown, which has its own label)
  autoCapture: boolean; // may fire onAutoCapture once everything has been good for CHECKS.goodHoldMs
  goodHint: string; // prompt shown when every check passes
  guide: Strings["guide"];
  onError: (e: CameraError) => void;
  onAutoCapture: () => void;
  /** Called whenever "every check passes" flips. The screen gates Capture on this. */
  onReady: (ready: boolean) => void;
}

function classify(e: unknown): CameraError {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "error";
}

const STARTING = { g: "starting" as Guidance, level: "warn" as Level };

/**
 * Live preview + check loop. The loop runs on a timer outside React; it only calls setState
 * when the prompt actually changes, so the component re-renders a few times per shot at most.
 */
export const CameraView = memo(function CameraView({
  ref,
  turn,
  active,
  showGuidance,
  autoCapture,
  goodHint,
  guide,
  onError,
  onAutoCapture,
  onReady,
}: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [state, setState] = useState(STARTING);

  // Everything the timer reads lives in refs.
  const live = useRef({
    active,
    turn,
    autoCapture,
    metrics: { frame: 0, face: null } as Metrics,
    face: null as FaceResult | null,
    detector: null as Detector | null,
    detState: "loading" as DetectorState,
    ready: false,
    goodSince: 0,
    autoFired: false,
    last: "starting" as Guidance,
    size: { w: 0, h: 0 },
  });
  const cb = useRef({ onError, onAutoCapture, onReady });
  cb.current = { onError, onAutoCapture, onReady };

  // A new shot (or returning from review) starts from scratch: nothing carries over from the last frame.
  useEffect(() => {
    const l = live.current;
    l.active = active;
    l.turn = turn;
    l.goodSince = 0;
    l.autoFired = false;
    l.face = null;
    l.last = "starting";
    setState(STARTING);
    if (l.ready) {
      l.ready = false;
      cb.current.onReady(false);
    }
  }, [active, turn]);

  // Confirming the checklist arms auto-capture afresh: the participant must then hold still for the full hold time.
  useEffect(() => {
    live.current.autoCapture = autoCapture;
    live.current.goodSince = 0;
  }, [autoCapture]);

  // The detector is shared and usually already warm (prefetched on the Instructions step).
  useEffect(() => {
    let cancelled = false;
    loadFaceDetector()
      .then((d) => {
        if (cancelled) return;
        live.current.detector = d;
        live.current.detState = "ready";
      })
      .catch(() => !cancelled && (live.current.detState = "failed"));
    return () => {
      cancelled = true;
    };
  }, []);

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

  // The check loop: ~3 Hz face detection, ~4 Hz lighting on the detected face, paused while inactive or hidden.
  useEffect(() => {
    const l = live.current;
    let analyzer: FrameAnalyzer | null = null;
    let lastFace = 0;
    let timer: number | undefined;

    const tick = () => {
      const v = video.current;
      const { w, h } = l.size;
      if (!l.active || !v || v.readyState < 2 || !v.videoWidth || !w || !h) return;
      analyzer ??= new FrameAnalyzer();

      const now = performance.now();
      if (l.detector && now - lastFace >= CHECKS.faceIntervalMs) {
        lastFace = now;
        try {
          l.face = toFaceResult(l.detector.detect(v, now));
        } catch {
          // A detector that throws can't vouch for anything: block capture rather than skip the check.
          l.detector = null;
          l.detState = "failed";
          l.face = null;
        }
      }
      // Lighting is judged on the face wherever it is, not on a fixed region of the preview.
      l.metrics = analyzer.analyze(v, l.face?.count === 1 ? l.face.box : null);

      const r = evaluate(l.metrics, l.face, l.detState, l.turn);
      if (r.g !== l.last) {
        l.last = r.g;
        setState(r);
      }
      const ready = r.level === "good";
      if (ready !== l.ready) {
        l.ready = ready;
        cb.current.onReady(ready);
      }

      if (ready && l.autoCapture) {
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

  const message = active && showGuidance ? (state.level === "good" ? goodHint : guide[state.g]) : "";

  // The preview is always a dark surface, so the overlay uses fixed on-video colours rather than theme tokens.
  return (
    <div ref={box} className="relative h-full w-full overflow-hidden bg-black">
      <video ref={video} className="mirror absolute inset-0 h-full w-full object-cover" playsInline muted autoPlay />
      {active && <FaceOverlay w={size.w} h={size.h} level={state.level} turn={turn} />}
      {message && (
        <div className="absolute inset-x-0 bottom-5 flex justify-center px-4">
          <p
            aria-live="polite"
            className={`flex max-w-full items-center gap-2.5 rounded-2xl py-2.5 pr-5 pl-4 text-[17px] leading-snug font-medium text-white tall:py-3 tall:text-[21px] ${
              state.level === "good" ? "bg-[#1F7A55]" : "bg-black/75"
            }`}
          >
            <span
              className={`size-2.5 shrink-0 rounded-full ${
                state.level === "good" ? "bg-white" : state.level === "warn" ? "bg-[#E6B25A]" : "bg-[#F0897D]"
              }`}
            />
            {message}
          </p>
        </div>
      )}
    </div>
  );
});
