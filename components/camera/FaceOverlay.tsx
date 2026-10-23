import { memo } from "react";
import { IconArrow } from "../ui/icons";
import { ovalFor, type Level } from "./checks";

const COLOR: Record<Level, string> = { bad: "#C0392B", warn: "#C98A12", good: "#2F9E5B" };

/** Static SVG oval + veil, with a CSS-pulsing guide ring and a nudge arrow for profile shots. */
export const FaceOverlay = memo(function FaceOverlay({
  w,
  h,
  level,
  turn,
}: {
  w: number;
  h: number;
  level: Level;
  turn: "none" | "left" | "right";
}) {
  if (!w || !h) return null;
  const o = ovalFor(w, h);
  const color = COLOR[level];
  // The preview is mirrored, so "turn to your left" moves the face towards the screen's left.
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg width={w} height={h} className="absolute inset-0">
        <path
          fillRule="evenodd"
          fill="rgba(250,248,243,0.72)"
          d={`M0 0H${w}V${h}H0Z M${o.cx - o.rx} ${o.cy} a${o.rx} ${o.ry} 0 1 0 ${o.rx * 2} 0 a${o.rx} ${o.ry} 0 1 0 ${-o.rx * 2} 0Z`}
        />
        {level !== "good" && (
          <ellipse className="anim-pulse" cx={o.cx} cy={o.cy} rx={o.rx} ry={o.ry} fill="none" stroke={color} strokeWidth={10} />
        )}
        <ellipse
          cx={o.cx}
          cy={o.cy}
          rx={o.rx}
          ry={o.ry}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={level === "good" ? undefined : "14 10"}
          style={{ transition: "stroke 0.2s" }}
        />
      </svg>
      {turn !== "none" && (
        <div
          className={`absolute flex items-center text-accent ${turn === "left" ? "anim-nudge-left" : "anim-nudge-right"}`}
          style={{
            top: o.cy - 24,
            left: turn === "left" ? Math.max(8, o.cx - o.rx - 72) : o.cx + o.rx + 16,
          }}
        >
          <span className={turn === "right" ? "rotate-180" : ""}>
            <IconArrow className="size-14" />
          </span>
        </div>
      )}
    </div>
  );
});
