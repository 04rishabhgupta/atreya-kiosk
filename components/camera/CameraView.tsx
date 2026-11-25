"use client";

import { memo, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { CAMERA_CONSTRAINTS, CAMERA_SETTLE_MS, FULL_HD_CONSTRAINTS, PREFERRED_CAMERA } from "@/lib/config";
import { perf } from "@/lib/perf";
import { grabStill, previewZoom, savedBandHeight } from "./checks";
import { FaceOverlay } from "./FaceOverlay";

export type CameraError = "denied" | "missing" | "busy" | "insecure" | "error";

export interface CameraHandle {
  grab(): Promise<{ blob: Blob; width: number; height: number }>;
  stream(): MediaStream | null;
}

interface Props {
  ref: Ref<CameraHandle>;
  turn: "none" | "left" | "right";
  showGuide: boolean; // the oval + turn arrow (live and countdown); hidden while reviewing, camera stays open
  onError: (e: CameraError) => void;
}

function classify(e: unknown): CameraError {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "error";
}

/**
 * The camera at its native 1920x1080 (see FULL_HD_CONSTRAINTS), preferring the kiosk's Logitech when more than
 * one camera can do it. Falls back to the best mode available only if no connected camera has 1920x1080.
 */
async function openCamera(): Promise<MediaStream> {
  const md = navigator.mediaDevices;
  let s: MediaStream;
  try {
    s = await md.getUserMedia(FULL_HD_CONSTRAINTS);
  } catch (e) {
    if (!(e instanceof DOMException && e.name === "OverconstrainedError")) throw e;
    console.warn("no connected camera offers 1920x1080; using the best mode available");
    return md.getUserMedia(CAMERA_CONSTRAINTS);
  }
  if (!PREFERRED_CAMERA.test(s.getVideoTracks()[0]?.label ?? "")) {
    const logitech = (await md.enumerateDevices()).find((d) => d.kind === "videoinput" && PREFERRED_CAMERA.test(d.label));
    if (logitech) {
      try {
        const video = { ...(FULL_HD_CONSTRAINTS.video as MediaTrackConstraints), deviceId: { exact: logitech.deviceId } };
        const p = await md.getUserMedia({ audio: false, video });
        s.getTracks().forEach((t) => t.stop());
        s = p;
      } catch {
        // keep the Full HD camera we already have
      }
    }
  }
  return s;
}

// Camera controls (Media Capture Image extensions), not yet in TypeScript's DOM types.
type Controls = { focusMode?: string[]; exposureMode?: string[]; whiteBalanceMode?: string[] };
type Settings = MediaTrackSettings & {
  focusMode?: string;
  focusDistance?: number;
  exposureMode?: string;
  exposureTime?: number;
  whiteBalanceMode?: string;
  colorTemperature?: number;
  resizeMode?: string;
};

const describe = (t: MediaStreamTrack) => {
  const s = t.getSettings() as Settings;
  return `${s.width}x${s.height} @${Math.round(s.frameRate ?? 0)}fps resize=${s.resizeMode ?? "?"} · ${t.label || "camera"}`;
};

/**
 * Locks focus, exposure and white balance at the values auto mode settled on, then reads the settings back.
 * Controls the camera or browser doesn't expose are left on auto. Returns what is actually in effect.
 */
async function lockControls(t: MediaStreamTrack): Promise<string> {
  const caps = (t.getCapabilities?.() ?? {}) as Controls;
  const now = t.getSettings() as Settings;
  const lock: Record<string, string | number> = {};
  if (caps.focusMode?.includes("manual") && now.focusDistance !== undefined) Object.assign(lock, { focusMode: "manual", focusDistance: now.focusDistance });
  if (caps.exposureMode?.includes("manual") && now.exposureTime !== undefined) Object.assign(lock, { exposureMode: "manual", exposureTime: now.exposureTime });
  if (caps.whiteBalanceMode?.includes("manual") && now.colorTemperature !== undefined) {
    Object.assign(lock, { whiteBalanceMode: "manual", colorTemperature: now.colorTemperature });
  }
  if (Object.keys(lock).length) {
    try {
      // Keep the existing constraints (the 1920x1080 mode); applyConstraints replaces the whole set.
      await t.applyConstraints({ ...t.getConstraints(), advanced: [lock] } as MediaTrackConstraints);
    } catch {
      // a control the driver rejects stays on auto
    }
  }
  const s = t.getSettings() as Settings;
  const state = (mode: string | undefined, value: number | undefined) => (mode ? `${mode}${mode === "manual" ? ` ${value}` : ""}` : "n/a");
  return `focus ${state(s.focusMode, s.focusDistance)} · exposure ${state(s.exposureMode, s.exposureTime)} · white balance ${state(s.whiteBalanceMode, s.colorTemperature)}`;
}

/**
 * Live preview with a positioning guide. There are no automatic checks: capture is never blocked by
 * face detection, positioning or lighting; the participant just taps Capture and the countdown runs.
 */
export const CameraView = memo(function CameraView({ ref, turn, showGuide, onError }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [frame, setFrame] = useState({ w: 0, h: 0 }); // the camera's actual resolution
  const cb = useRef({ onError });
  cb.current = { onError };

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
    let settle = 0;
    const open = async () => {
      if (!window.isSecureContext) return cb.current.onError("insecure");
      if (!navigator.mediaDevices?.getUserMedia) return cb.current.onError("missing");
      try {
        const s = await openCamera();
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        streamRef.current = s;
        const track = s.getVideoTracks()[0];
        if (track) {
          perf.video = describe(track);
          console.info(`camera: ${perf.video}`);
          window.clearTimeout(settle);
          settle = window.setTimeout(() => {
            if (track.readyState !== "live") return;
            void lockControls(track).then((r) => {
              perf.check = r;
              console.info(`camera locked: ${r}`);
            });
          }, CAMERA_SETTLE_MS);
        }
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
      window.clearTimeout(settle);
      document.removeEventListener("visibilitychange", onVis);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (video.current) video.current.srcObject = null;
    };
  }, []);

  // Track the box size (the overlay is drawn in box pixels).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onFrame = (e: React.SyntheticEvent<HTMLVideoElement>) =>
    setFrame({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight });
  const zoom = previewZoom(size.w, size.h, frame.w, frame.h);

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden bg-black">
      {/* Mirrored and zoomed together (uniform scale: no distortion). The zoom is preview-only. */}
      <video
        ref={video}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: `scale(${-zoom}, ${zoom})` }}
        onLoadedMetadata={onFrame}
        onResize={onFrame}
        playsInline
        muted
        autoPlay
      />
      {showGuide && <FaceOverlay w={size.w} h={size.h} bandH={savedBandHeight(size.w, size.h, frame.w, frame.h, zoom)} turn={turn} />}
    </div>
  );
});
