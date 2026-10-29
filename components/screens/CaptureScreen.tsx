"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AUTO_CAPTURE, ENABLE_VIDEO, SHOTS, VIDEO } from "@/lib/config";
import { fmt } from "@/lib/strings";
import { CameraView, type CameraError, type CameraHandle } from "../camera/CameraView";
import { markActive } from "../IdleGuard";
import { useActions, useKiosk, useStrings } from "../KioskProvider";
import { Button } from "../ui/Button";
import { IconBack, IconCamera, IconCheck, IconRefresh, IconX, PoseGlyph } from "../ui/icons";
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
  // Capture is allowed only while the automatic checks pass: a clearly visible face, one person, even lighting.
  const [ready, setReady] = useState(false);
  const canCapture = phase === "live" && ready;

  const shot = SHOTS[idx]!;
  const current = captures[shot.id];

  const startCountdown = useCallback(() => {
    markActive();
    setCount(3);
    setPhase("countdown");
  }, []);
  const onAutoCapture = startCountdown; // CameraView only fires this when autoCapture (below) allows it
  const onError = useCallback((e: CameraError) => setError(e), []);
  const onReady = useCallback((r: boolean) => setReady(r), []);

  // Checks keep running during the 3-2-1: if anything fails before the shot, cancel and show why.
  useEffect(() => {
    if (phase === "countdown" && !ready) setPhase("live");
  }, [phase, ready]);

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
          <div className="flex size-20 items-center justify-center rounded-full bg-coral/10 text-coral tall:size-24">
            <IconCamera className="size-10" />
          </div>
          <h1 className="t-title mt-6 text-fg">{e.title}</h1>
          <p className="t-lead mt-3 max-w-[34ch]">{e.body}</p>
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
      wide
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
            <Button className="flex-1" disabled={!canCapture} onClick={() => canCapture && startCountdown()}>
              <IconCamera /> {phase === "countdown" ? count || "" : t.capture}
            </Button>
          </>
        )
      }
    >
      {/* Shot tabs: the pose glyph makes front / left / right readable at a glance. */}
      {/* Phones: slim name pills. Landscape phones: hidden (the guide panel says "Photo n of 3"). */}
      <ol className="mb-3 grid grid-cols-3 gap-2 sm:mb-4 sm:gap-3 tall:mb-6 tall:gap-4 compact:hidden cramped:hidden">
        {SHOTS.map((s, i) => {
          const on = i === idx && phase !== "video";
          const done = !!captures[s.id];
          return (
            <li
              key={s.id}
              aria-current={on ? "step" : undefined}
              className={`relative flex min-h-11 items-center justify-center gap-3 rounded-xl border px-2 transition-colors duration-200 sm:min-h-15 sm:justify-start sm:px-3 tall:min-h-[76px] tall:px-4 ${
                on ? "border-mint bg-surface text-fg shadow-card ring-1 ring-mint" : done ? "border-hair bg-surface text-fg-2" : "border-hair bg-surface-2 text-fg-3"
              }`}
            >
              <PoseGlyph turn={s.turn} className="hidden size-10 shrink-0 sm:block tall:size-12" />
              <span className="min-w-0">
                <span className="hidden text-[12px] font-semibold tracking-[0.08em] tabular-nums opacity-70 sm:block tall:text-[14px]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="block truncate text-[14px] font-medium sm:text-[16px] tall:text-[19px]">{t.shotNames[s.id]}</span>
              </span>
              {done && (
                <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-mint text-white sm:top-2 sm:right-2 tall:size-6">
                  <IconCheck className="size-3.5" />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Portrait kiosk: camera and guidance side by side, so instructions stay visible while posing. */}
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 sm:grid-cols-[minmax(0,1.38fr)_minmax(0,1fr)] sm:grid-rows-1 sm:gap-5 tall:gap-6 compact:gap-3">
        <div className="relative min-h-0 overflow-hidden rounded-2xl bg-black shadow-card">
          <CameraView
            key={camKey}
            ref={cam}
            turn={shot.turn}
            active={phase === "live" || phase === "countdown"}
            showGuidance={phase === "live"}
            autoCapture={AUTO_CAPTURE && phase === "live"}
            goodHint={AUTO_CAPTURE ? t.guide.goodAuto : t.guide.good}
            guide={t.guide}
            onError={onError}
            onAutoCapture={onAutoCapture}
            onReady={onReady}
          />
          {phase === "countdown" && count > 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/25">
              <span
                key={count}
                className="anim-count text-[96px] leading-none font-semibold text-ivory tabular-nums [text-shadow:0_4px_20px_rgba(0,0,0,.5)] sm:text-[140px] tall:text-[190px] compact:text-[80px]"
              >
                {count}
              </span>
              <span className="mt-2 rounded-full bg-black/55 px-5 py-2 text-[17px] font-medium text-ivory tall:text-[20px]">
                {t.guide.holdStill}
              </span>
            </div>
          )}
          {flash > 0 && <div key={flash} className="anim-flash pointer-events-none absolute inset-0 bg-white opacity-0" />}
          {reviewing && (
            <>
              {/* Same framing as the live preview; the uploaded file is still the full, uncropped frame. */}
              <img src={current.url} alt="" className="mirror anim-fade absolute inset-0 h-full w-full bg-black object-cover" />
              <span className="anim-fade absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/60 py-2 pr-4 pl-2.5 text-[15px] font-medium text-ivory tall:text-[18px]">
                <span className="flex size-6 items-center justify-center rounded-full bg-mint text-white">
                  <IconCheck className="size-3.5" />
                </span>
                {t.shotNames[shot.id]}
              </span>
            </>
          )}
        </div>

        <GuidePanel
          t={t}
          turn={phase === "video" ? "none" : shot.turn}
          label={phase === "video" ? t.videoTitle : fmt(t.shotProgress, { n: idx + 1, total: SHOTS.length })}
          instruction={instruction}
        />
      </div>

    </ScreenLayout>
  );
}

/** Current-shot pose and instruction plus the Do / Don't checklist, shown beside the live preview. */
function GuidePanel({
  t,
  turn,
  label,
  instruction,
}: {
  t: ReturnType<typeof useStrings>;
  turn: "none" | "left" | "right";
  label: string;
  instruction: string;
}) {
  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto rounded-2xl border border-hair bg-surface shadow-card">
      <div className="flex items-start gap-3 border-b border-hair bg-surface-2 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4 tall:px-7 tall:py-6 compact:gap-3 compact:px-4 compact:py-2.5 cramped:py-2">
        <PoseGlyph turn={turn} className="size-9 shrink-0 text-fg sm:size-12 tall:size-16 compact:size-9" />
        <div className="min-w-0">
          <p className="t-kicker">{label}</p>
          <p aria-live="polite" className="mt-0.5 text-[15px] leading-[1.35] font-semibold text-fg sm:mt-1 sm:text-[17px] tall:text-[22px] compact:mt-0.5 compact:text-[15px]">
            {instruction}
          </p>
        </div>
      </div>
      {/* Portrait phones: the checklist as short chips, so the camera keeps most of the screen. */}
      <ul className="flex flex-wrap gap-1.5 px-3 py-2.5 sm:hidden">
        {t.camChips.do.map((it) => (
          <Chip key={it} good text={it} />
        ))}
        {t.camChips.dont.map((it) => (
          <Chip key={it} good={false} text={it} />
        ))}
      </ul>
      {/* Landscape phones: Do and Don't side by side. */}
      <div className="grid grid-cols-2 max-sm:hidden sm:block compact:grid">
        <GuideList good heading={t.camDosHeading} items={t.camDos} />
        <GuideList good={false} heading={t.camDontsHeading} items={t.camDonts} divider />
      </div>
      {/* What actually gates Capture, so a disabled button is never a surprise. */}
      <section className="mt-auto hidden border-t border-hair bg-surface-2 px-5 py-4 sm:block tall:px-7 tall:py-6 compact:hidden">
        <h2 className="t-kicker mb-2 tall:mb-3">{t.camAutoHeading}</h2>
        <ul>
          {t.camAuto.map((it) => (
            <li key={it} className="flex items-center gap-3 py-1 text-[15px] leading-snug text-fg-2 tall:py-2 tall:text-[19px]">
              <span className="size-1.5 shrink-0 rounded-full bg-mint" />
              {it}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

function Chip({ good, text }: { good: boolean; text: string }) {
  const Icon = good ? IconCheck : IconX;
  return (
    <li
      className={`inline-flex items-center gap-1 rounded-full py-1 pr-2.5 pl-1.5 text-[13.5px] leading-tight font-medium ${
        good ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral"
      }`}
    >
      <Icon className="size-3.5 shrink-0" />
      {text}
    </li>
  );
}

function GuideList({ good, heading, items, divider = false }: { good: boolean; heading: string; items: string[]; divider?: boolean }) {
  const Icon = good ? IconCheck : IconX;
  return (
    <section className={`px-3 py-3 sm:px-5 sm:py-3.5 tall:px-7 tall:py-6 compact:px-3 compact:py-2.5 cramped:py-2 ${divider ? "border-l border-hair sm:border-t sm:border-l-0 compact:border-t-0 compact:border-l" : ""}`}>
      <h2 className={`t-kicker mb-1.5 sm:mb-2 tall:mb-3 ${good ? "text-mint" : "text-coral"}`}>{heading}</h2>
      <ul>
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 py-1 text-[14px] leading-snug text-fg sm:gap-3 sm:py-1.5 sm:text-[17px] tall:py-3 tall:text-[22px] compact:gap-2 compact:py-0.5 compact:text-[14px] cramped:py-0.5 cramped:text-[13.5px]">
            <span
              className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full sm:size-6 tall:size-7 compact:size-5 ${
                good ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral"
              }`}
            >
              <Icon className="size-3.5 tall:size-4" />
            </span>
            {it}
          </li>
        ))}
      </ul>
    </section>
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
