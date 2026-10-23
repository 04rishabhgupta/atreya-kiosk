"use client";

import { useEffect, useRef } from "react";

const MIN_INK = 40; // px of stroke before we accept it as a signature

/** Finger signature on a small canvas, exported as a compact transparent PNG. */
export function SignaturePad({
  existingUrl,
  onChange,
  clearLabel,
  hint,
  invalid,
}: {
  existingUrl: string | null;
  onChange: (png: Blob | null) => void;
  clearLabel: string;
  hint: string;
  invalid: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ink = useRef(0);
  const last = useRef<{ x: number; y: number } | null>(null);
  const hintRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // cap for weak GPUs and small PNGs
    c.width = Math.round(c.clientWidth * dpr);
    c.height = Math.round(c.clientHeight * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1c2620";
    if (existingUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.clientWidth, c.clientHeight);
      img.src = existingUrl;
      ink.current = MIN_INK;
      hintRef.current?.classList.add("opacity-0");
    }
    // Only on mount: later changes come from this pad itself.
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const clear = () => {
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    ink.current = 0;
    hintRef.current?.classList.remove("opacity-0");
    onChange(null);
  };

  return (
    <div>
      <div className={`relative h-48 overflow-hidden rounded-2xl border-2 bg-card ${invalid ? "border-bad" : "border-line"}`}>
        <span
          ref={hintRef}
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted transition-opacity duration-150"
        >
          {hint}
        </span>
        <div className="pointer-events-none absolute right-6 bottom-10 left-6 border-b-2 border-dashed border-line" />
        <canvas
          ref={canvas}
          className="absolute inset-0 h-full w-full"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            last.current = point(e);
            hintRef.current?.classList.add("opacity-0");
          }}
          onPointerMove={(e) => {
            if (!last.current) return;
            const ctx = e.currentTarget.getContext("2d");
            const p = point(e);
            if (!ctx) return;
            ctx.beginPath();
            ctx.moveTo(last.current.x, last.current.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            ink.current += Math.hypot(p.x - last.current.x, p.y - last.current.y);
            last.current = p;
          }}
          onPointerUp={(e) => {
            last.current = null;
            if (ink.current < MIN_INK) return;
            e.currentTarget.toBlob((b) => b && onChange(b), "image/png");
          }}
          onPointerCancel={() => (last.current = null)}
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={clear} className="min-h-14 rounded-xl px-5 font-semibold text-brand active:bg-brand-50">
          {clearLabel}
        </button>
      </div>
    </div>
  );
}
