import type { SVGProps } from "react";

// One stroke icon set, drawn on a 24px grid with 1.75 strokes so they sit
// together at every size.
type P = SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

// BYOB mark: a sprout on a hill, growing your own safety net.
export const Logo = (props: P) => (
  <svg width={30} height={30} viewBox="0 0 32 32" aria-hidden {...props}>
    <rect width="32" height="32" rx="9" fill="var(--brand)" />
    <g fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 25.5Q16 19 27 25.5" />
      <path d="M16 22.2C16 18.5 16.6 15 18 12" />
      <path d="M18 12Q18.4 5.4 25 5Q24.6 11.6 18 12Z" />
      <path d="M18 12 22.2 7.8" />
      <path d="M16.2 17.2Q14.5 11.7 9 13.2Q10.7 18.7 16.2 17.2Z" />
      <path d="M16.2 17.2 12.4 15" />
    </g>
  </svg>
);

export const Wordmark = ({ className = "" }: { className?: string }) => (
  <span className={`font-[family-name:var(--font-display)] font-bold tracking-[-0.03em] ${className}`}>byob</span>
);

export const IconStart = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);

export const IconGaps = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z" />
    <path d="M12 8.5v4" />
    <path d="M12 15.8h.01" />
  </svg>
);

export const IconForecast = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20V10" />
    <path d="M10 20V4" />
    <path d="M16 20v-7" />
    <path d="M21 20H3" />
  </svg>
);

export const IconClaim = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
    <path d="m9 14 2 2 4-4" />
  </svg>
);

export const IconPool = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5" />
    <path d="M15 14.3c2.6-.3 4.8 1.3 5.5 4.2" />
  </svg>
);

export const IconArrowUp = (p: P) => (
  <svg {...base(p)} strokeWidth={2.25}>
    <path d="M12 19V5" />
    <path d="m6 11 6-6 6 6" />
  </svg>
);

export const IconArrowRight = (p: P) => (
  <svg {...base(p)} strokeWidth={2}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

export const IconBread = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 20h12a2 2 0 0 0 2-2v-7a3 3 0 0 0 1-2.3C21 6 17 4 12 4S3 6 3 8.7A3 3 0 0 0 4 11v7a2 2 0 0 0 2 2Z" />
    <path d="M9 9.5v2" />
    <path d="M15 9.5v2" />
  </svg>
);

export const IconCamera = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

export const IconCar = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 16H4a1 1 0 0 1-1-1v-3l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 7l2 5v3a1 1 0 0 1-1 1h-1" />
    <path d="M9 16h6" />
    <circle cx="7" cy="16.5" r="2" />
    <circle cx="17" cy="16.5" r="2" />
    <path d="M3.5 11h17" />
  </svg>
);

export const IconWrench = (p: P) => (
  <svg {...base(p)}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8Z" />
  </svg>
);

export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
    <path d="M12 17v-6" />
    <path d="m9.5 13.5 2.5-2.5 2.5 2.5" />
  </svg>
);

export const IconCheck = (p: P) => (
  <svg {...base(p)} strokeWidth={2.25}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const IconX = (p: P) => (
  <svg {...base(p)} strokeWidth={2.25}>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </svg>
);

export const IconSpark = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  </svg>
);

export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);
