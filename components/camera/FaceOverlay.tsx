import { memo } from "react";
import { IconArrow } from "../ui/icons";
import { ovalFor, type Level } from "./checks";

const COLOR: Record<Level, string> = { bad: "#F0897D", warn: "#E6B25A", good: "#86D4AE" };

/** Static SVG oval + veil (dashed until every check passes) and a nudge arrow for profile shots. */
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
  // The oval nearly fills the column width, so the arrow sits above it rather than beside it.
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg width={w} height={h} className="absolute inset-0">
        <path
          fillRule="evenodd"
          fill="rgba(5,10,8,0.66)"
          d={`M0 0H${w}V${h}H0Z M${o.cx - o.rx} ${o.cy} a${o.rx} ${o.ry} 0 1 0 ${o.rx * 2} 0 a${o.rx} ${o.ry} 0 1 0 ${-o.rx * 2} 0Z`}
        />
        <ellipse
          cx={o.cx}
          cy={o.cy}
          rx={o.rx}
          ry={o.ry}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={level === "good" ? undefined : "12 10"}
          style={{ transition: "stroke 0.2s" }}
        />
      </svg>
      {turn !== "none" && (
        <div
          className={`absolute flex items-center text-ember ${turn === "left" ? "anim-nudge-left" : "anim-nudge-right"}`}
          style={{ top: Math.max(8, o.cy - o.ry - 68), left: o.cx - 28 }}
        >
          <span className={turn === "right" ? "rotate-180" : ""}>
            <IconArrow className="size-12" />
          </span>
        </div>
      )}
    </div>
  );
});
