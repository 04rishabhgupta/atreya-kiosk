"use client";

import { memo, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { CAMERA_CONSTRAINTS } from "@/lib/config";
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
