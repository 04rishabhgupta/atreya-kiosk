"use client";

import { useEffect, useState } from "react";
import { perf } from "@/lib/perf";

/** ?perf=1 only: frame rate, camera-check cost and memory, for checking smoothness on the real kiosk. */
export default function PerfOverlay() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    let frames = 0;
    let raf = requestAnimationFrame(function count() {
      frames++;
      raf = requestAnimationFrame(count);
    });
    const chrome = /Chrome\/(\d+)/.exec(navigator.userAgent)?.[1] ?? "?";
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const id = window.setInterval(() => {
      setLines([
        `fps ${frames}`,
        `chrome ${chrome} · cores ${navigator.hardwareConcurrency ?? "?"}`,
        mem ? `js heap ${Math.round(mem.usedJSHeapSize / 1048576)} MB` : "js heap n/a",
        perf.video
          ? `camera ${perf.video} · frame ${perf.sampleMs.toFixed(1)} ms · face ${perf.detectMs.toFixed(1)} ms every ${Math.round(perf.faceEveryMs)} ms`
          : "camera off",
      ]);
      frames = 0;
    }, 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed top-2 left-2 z-[60] rounded-lg bg-black/75 px-3 py-2 font-mono text-[12px] leading-relaxed text-white">
      {lines.map((l) => (
        <div key={l}>{l}</div>
      ))}
    </div>
  );
}
