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

// Larger illustrations for the About cards (brand-coloured).
export const IllustrationFace = ({ className = "size-32" }: P) => (
  <svg viewBox="0 0 120 120" className={className} aria-hidden>
    <circle cx="60" cy="60" r="56" fill="#EDF4EF" />
    <ellipse cx="60" cy="58" rx="26" ry="33" fill="none" stroke="#1B4332" strokeWidth="4" />
    <circle cx="50" cy="54" r="3" fill="#1B4332" />
    <circle cx="70" cy="54" r="3" fill="#1B4332" />
    <path d="M51 72q9 6 18 0" fill="none" stroke="#1B4332" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M20 30v-10h10M100 30v-10H90M20 90v10h10M100 90v10H90" fill="none" stroke="#E07B28" strokeWidth="4" strokeLinecap="round" />
  </svg>
);
export const IllustrationData = ({ className = "size-32" }: P) => (
  <svg viewBox="0 0 120 120" className={className} aria-hidden>
    <circle cx="60" cy="60" r="56" fill="#EDF4EF" />
    <rect x="30" y="68" width="12" height="22" rx="3" fill="#2D6A4F" />
    <rect x="48" y="54" width="12" height="36" rx="3" fill="#1B4332" />
    <rect x="66" y="40" width="12" height="50" rx="3" fill="#E07B28" />
    <rect x="84" y="30" width="8" height="60" rx="3" fill="#1B4332" opacity=".35" />
    <path d="M28 52l20-14 18 8 24-18" fill="none" stroke="#1B4332" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IllustrationNotDx = ({ className = "size-32" }: P) => (
  <svg viewBox="0 0 120 120" className={className} aria-hidden>
    <circle cx="60" cy="60" r="56" fill="#FDF1E6" />
    <rect x="36" y="26" width="48" height="64" rx="6" fill="#fff" stroke="#1B4332" strokeWidth="4" />
    <path d="M60 44v20M50 54h20" stroke="#1B4332" strokeWidth="5" strokeLinecap="round" />
    <path d="M30 96L90 24" stroke="#E07B28" strokeWidth="6" strokeLinecap="round" />
  </svg>
);
export const IllustrationClock = ({ className = "size-32" }: P) => (
  <svg viewBox="0 0 120 120" className={className} aria-hidden>
    <circle cx="60" cy="60" r="56" fill="#EDF4EF" />
    <circle cx="60" cy="60" r="32" fill="#fff" stroke="#1B4332" strokeWidth="4" />
    <path d="M60 42v18l12 8" fill="none" stroke="#E07B28" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

// Do / Don't illustrations: a clear face vs. one with cap, glasses and backlight.
export const IllustrationDo = ({ className = "h-28 w-28" }: P) => (
  <svg viewBox="0 0 120 120" className={className} aria-hidden>
    <rect width="120" height="120" rx="16" fill="#EDF4EF" />
    <ellipse cx="60" cy="60" rx="30" ry="38" fill="none" stroke="#2F9E5B" strokeWidth="4" strokeDasharray="6 5" />
    <ellipse cx="60" cy="60" rx="22" ry="28" fill="#F3D9BF" />
    <path d="M38 50q2-22 22-22t22 22q-6-12-22-12t-22 12z" fill="#3B2A20" />
    <circle cx="52" cy="58" r="2.5" fill="#1C2620" />
    <circle cx="68" cy="58" r="2.5" fill="#1C2620" />
    <path d="M54 74h12" stroke="#1C2620" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
export const IllustrationDont = ({ className = "h-28 w-28" }: P) => (
  <svg viewBox="0 0 120 120" className={className} aria-hidden>
    <rect width="120" height="120" rx="16" fill="#FBECEA" />
    <circle cx="96" cy="24" r="14" fill="#F6C343" />
    <ellipse cx="60" cy="64" rx="22" ry="28" fill="#D9BFA6" />
    <path d="M34 48q4-18 26-18t26 18z" fill="#C0392B" />
    <path d="M30 48h40" stroke="#C0392B" strokeWidth="5" strokeLinecap="round" />
    <rect x="44" y="56" width="13" height="9" rx="3" fill="#1C2620" />
    <rect x="63" y="56" width="13" height="9" rx="3" fill="#1C2620" />
    <path d="M57 60h6" stroke="#1C2620" strokeWidth="2.5" />
    <rect x="46" y="72" width="28" height="16" rx="5" fill="#9FB3C8" />
  </svg>
);
