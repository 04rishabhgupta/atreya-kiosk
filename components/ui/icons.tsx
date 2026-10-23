// Tiny inline SVG icons (stroke = currentColor). No icon library.
type P = { className?: string };
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconCheck = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const IconX = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconBack = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const IconCamera = ({ className = "size-7" }: P) => (
  <svg {...base} className={className}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);
export const IconRefresh = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6" />
  </svg>
);
export const IconGlobe = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9s1-6.3 3.5-9z" />
  </svg>
);
export const IconArrow = ({ className = "size-12" }: P) => (
  <svg {...base} strokeWidth={2.5} className={className}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const IconArrowRight = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconClock = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const IconChevronDown =({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/** The atreya.ai mark (matches app/icon.svg): face oval with the accent dot. */
export const BrandMark = ({ className = "size-9" }: P) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <rect width="32" height="32" rx="8" fill="#1B4332" />
    <ellipse cx="16" cy="15.5" rx="7" ry="9" fill="none" stroke="#fff" strokeWidth="2.4" />
    <circle cx="24.5" cy="24.5" r="3" fill="#E07B28" />
  </svg>
);

/**
 * Head pose for a shot, as a fine line drawing in currentColor (ember arrow shows the turn).
 * Direction matches the mirrored camera preview and its nudge arrow: "right" = nose towards screen-right.
 */
export const PoseGlyph = ({ turn, className = "size-16" }: P & { turn: "none" | "left" | "right" }) => {
  const d = turn === "right" ? 1 : turn === "left" ? -1 : 0;
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 118c4-22 20-30 38-30s34 8 38 30" strokeOpacity="0.35" strokeWidth="2" />
      <ellipse cx="60" cy="54" rx={d ? 21 : 23} ry="28" strokeWidth="2.2" />
      {d === 0 ? (
        <>
          <circle cx="52" cy="51" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="68" cy="51" r="2.2" fill="currentColor" stroke="none" />
          <path d="M60 54v7M55 68h10" strokeOpacity="0.7" strokeWidth="2" />
        </>
      ) : (
        <>
          <circle cx={60 + d * 11} cy="51" r="2.2" fill="currentColor" stroke="none" />
          <path d={`M${60 + d * 19} 47l${d * 6} 11l${-d * 6} 2`} strokeWidth="2" />
          <path d={`M${60 - d * 7} 49q${-d * 6} 6 0 12`} strokeOpacity="0.5" strokeWidth="2" />
          <path d={`M${60 - d * 13} 14h${d * 26}m${-d * 6}-6l${d * 6} 6l${-d * 6} 6`} stroke="#EA8A3C" strokeWidth="2.6" />
        </>
      )}
    </svg>
  );
};
