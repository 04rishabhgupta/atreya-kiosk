"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ENABLE_VIDEO, SHOTS, VIDEO } from "@/lib/config";
import { fmt } from "@/lib/strings";
import { CameraView, type CameraError, type CameraHandle } from "../camera/CameraView";
import { markActive } from "../IdleGuard";
import { useActions, useKiosk, useStrings } from "../KioskProvider";
import { Button } from "../ui/Button";
import { IconBack, IconCamera, IconCheck, IconRefresh } from "../ui/icons";
import { ScreenLayout } from "../ui/ScreenLayout";

type Phase = "live" | "countdown" | "review" | "video";

export default function CaptureScreen() {
  const t = useStrings();
  const { captures, video } = useKiosk();
  const { next, back, setCapture, setVideo } = useActions();
  const cam = useRef<CameraHandle>(null);

  const firstMissing = SHOTS.findIndex((s) => !captures[s.id]);
  const [idx, setIdx] = useState(firstMissing === -1 ? 0 : firstMissing);
  const [phase, setPhase] = useState<Phase>(() => (captures[SHOTS[idx]!.id] ? "review" : "live"));
  const [count, setCount] = useState(3);
  const [flash, setFlash] = useState(0);
  const [error, setError] = useState<CameraError | null>(null);
  const [camKey, setCamKey] = useState(0);

  const shot = SHOTS[idx]!;
  const current = captures[shot.id];

  const startCountdown = useCallback(() => {
    markActive();
    setCount(3);
    setPhase("countdown");
  }, []);
  const onAutoCapture = startCountdown;
  const onError = useCallback((e: CameraError) => setError(e), []);

  // 3-2-1, then flash + grab.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count > 0) {
      const id = window.setTimeout(() => setCount((c) => c - 1), 1000);
      return () => window.clearTimeout(id);
    }
    let alive = true;
    setFlash((f) => f + 1);
    cam.current
      ?.grab()
      .then(({ blob }) => {
        if (!alive) return;
        setCapture(shot.id, { blob, url: URL.createObjectURL(blob) });
        setPhase("review");
      })
      .catch(() => alive && setPhase("live"));
    return () => {
      alive = false;
    };
  }, [phase, count, shot.id, setCapture]);

  const retake = () => {
    setCapture(shot.id, null); // revokes the old blob URL
    setPhase("live");
  };

  const accept = () => {
    const n = idx + 1;
    if (n < SHOTS.length) {
      setIdx(n);
      setPhase(captures[SHOTS[n]!.id] ? "review" : "live");
    } else if (ENABLE_VIDEO) {
      setPhase("video");
    } else {
      next();
    }
  };

  const goBack = () => {
    if (phase === "video") return setPhase("review");
    if (idx === 0) return back();
    setIdx(idx - 1);
    setPhase("review");
  };

  if (error) {
    const e = { denied: t.camDenied, missing: t.camMissing, busy: t.camBusy, insecure: t.camInsecure, error: t.camError }[error];
    return (
      <ScreenLayout
        scroll={false}
        actions={
          <>
            <Button variant="secondary" onClick={back} aria-label={t.back}>
              <IconBack />
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setError(null);
                setCamKey((k) => k + 1);
              }}
            >
              <IconRefresh /> {t.tryAgain}
            </Button>
          </>
        }
      >
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="flex size-28 items-center justify-center rounded-full bg-bad-50 text-bad">
            <IconCamera className="size-14" />
          </div>
          <h1 className="mt-6 text-[32px] font-bold text-brand">{e.title}</h1>
          <p className="mt-3 max-w-xl text-[22px] text-muted">{e.body}</p>
        </div>
      </ScreenLayout>
    );
  }

  const reviewing = phase === "review" && current;
  const instruction =
    phase === "video" ? fmt(t.videoBody, { n: VIDEO.seconds }) : reviewing ? t.reviewHint : t.shotInstr[shot.turn];

  return (
    <ScreenLayout
      scroll={false}
      actions={
        phase === "video" ? (
          <VideoActions t={t} cam={cam} has={!!video} onDone={(b) => setVideo(b)} onNext={next} onBack={goBack} />
        ) : reviewing ? (
          <>
            <Button variant="secondary" className="flex-1" onClick={retake}>
              <IconRefresh /> {t.retake}
            </Button>
            <Button className="flex-1" onClick={accept}>
              <IconCheck /> {t.looksGood}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={goBack} aria-label={t.back} disabled={phase === "countdown"}>
              <IconBack />
            </Button>
            <Button className="flex-1" disabled={phase === "countdown"} onClick={startCountdown}>
              <IconCamera /> {phase === "countdown" ? count || "" : t.capture}
            </Button>
          </>
        )
      }
    >
      <div className="mb-3 flex items-center gap-2">
        {SHOTS.map((s, i) => (
          <div
            key={s.id}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[18px] font-semibold ${
              i === idx && phase !== "video" ? "bg-brand text-white" : captures[s.id] ? "bg-brand-50 text-brand" : "bg-line/60 text-muted"
            }`}
          >
            {captures[s.id] && <IconCheck className="size-5" />}
            {t.shotNames[s.id]}
          </div>
        ))}
      </div>
      <p className="mb-3 min-h-[2.9em] text-center text-[22px] font-semibold">
        {phase !== "video" && <span className="text-muted">{fmt(t.shotProgress, { n: idx + 1, total: SHOTS.length })} · </span>}
        {instruction}
      </p>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl bg-ink">
        <CameraView
          key={camKey}
          ref={cam}
          turn={shot.turn}
          faceCheck={shot.faceCheck}
          active={phase === "live"}
          guide={t.guide}
          onError={onError}
          onAutoCapture={onAutoCapture}
        />
        {phase === "countdown" && count > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span key={count} className="anim-count text-[160px] leading-none font-bold text-white [text-shadow:0_2px_8px_rgba(0,0,0,.5)]">
              {count}
            </span>
          </div>
        )}
        {flash > 0 && <div key={flash} className="anim-flash pointer-events-none absolute inset-0 bg-white opacity-0" />}
        {reviewing && (
          <img src={current.url} alt="" className="mirror anim-fade absolute inset-0 h-full w-full bg-ink object-contain" />
        )}
      </div>
    </ScreenLayout>
  );
}

/** Optional rPPG clip (ENABLE_VIDEO). Chunks are capped so the upload stays under the body limit. */
function VideoActions({
  t,
  cam,
  has,
  onDone,
  onNext,
  onBack,
}: {
  t: ReturnType<typeof useStrings>;
  cam: React.RefObject<CameraHandle | null>;
  has: boolean;
  onDone: (b: Blob | null) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [left, setLeft] = useState<number | null>(null);
  const rec = useRef<MediaRecorder | null>(null);

  useEffect(() => () => rec.current?.state === "recording" ? rec.current.stop() : undefined, []);

  const start = () => {
    const stream = cam.current?.stream();
    if (!stream || typeof MediaRecorder === "undefined") return onNext();
    const mime = ["video/webm;codecs=vp8", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const r = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO.bitsPerSecond });
    const chunks: Blob[] = [];
    let bytes = 0;
    r.ondataavailable = (e) => {
      chunks.push(e.data);
      bytes += e.data.size;
      if (bytes >= VIDEO.maxBytes - 150_000 && r.state === "recording") r.stop();
    };
    r.onstop = () => {
      setLeft(null);
      onDone(new Blob(chunks, { type: (r.mimeType || "video/webm").split(";")[0] }));
    };
    rec.current = r;
    r.start(1000);
    setLeft(VIDEO.seconds);
    markActive();
  };

  useEffect(() => {
    if (left === null) return;
    if (left <= 0) {
      if (rec.current?.state === "recording") rec.current.stop();
      return;
    }
    const id = window.setTimeout(() => setLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [left]);

  if (left !== null)
    return (
      <Button className="flex-1" disabled>
        {fmt(t.videoRecording, { n: left })}
      </Button>
    );
  return (
    <>
      <Button variant="secondary" onClick={onBack} aria-label={t.back}>
        <IconBack />
      </Button>
      {has ? (
        <>
          <Button variant="secondary" className="flex-1" onClick={start}>
            {t.videoRedo}
          </Button>
          <Button className="flex-1" onClick={onNext}>
            {t.continue}
          </Button>
        </>
      ) : (
        <Button className="flex-1" onClick={start}>
          {t.videoStart}
        </Button>
      )}
    </>
  );
}
