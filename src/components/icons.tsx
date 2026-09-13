// ============================================================
// Minimal line-icon set, hand-drawn as inline SVG so the app doesn't
// need a new icon-library dependency. Every icon takes a `size` and
// `color`/currentColor via style, and is stroke-based to match the
// reference UI's icon style.
// ============================================================
import type { CSSProperties } from "react";

interface IconProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function HomeIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  );
}

export function UsersIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M15.5 14.3c2.4.4 4 2.1 4 4.7" />
    </svg>
  );
}

export function BoxIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z" />
      <path d="M3.5 7.5 12 11.5l8.5-4" />
      <path d="M12 11.5v9" />
    </svg>
  );
}

export function TrendingIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M3.5 16.5 9.5 10l4 4 6.5-7.5" />
      <path d="M15.5 6h4.5v4.5" />
    </svg>
  );
}

export function SettingsIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.3M12 18.2v2.3M4.9 6.1l1.7 1.6M17.4 16.3l1.7 1.6M3.5 12h2.3M18.2 12h2.3M4.9 17.9l1.7-1.6M17.4 7.7l1.7-1.6" />
    </svg>
  );
}

export function ArrowDownCircleIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v9M8.3 12.7 12 16.5l3.7-3.8" />
    </svg>
  );
}

export function ArrowUpCircleIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16.5v-9M8.3 11.3 12 7.5l3.7 3.8" />
    </svg>
  );
}

export function SwapIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M4 8h13M13.5 4.5 17 8l-3.5 3.5" />
      <path d="M20 16H7M10.5 12.5 7 16l3.5 3.5" />
    </svg>
  );
}

export function PersonIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
    </svg>
  );
}

export function DotsIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <circle cx="5" cy="12" r="1.3" fill={color} />
      <circle cx="12" cy="12" r="1.3" fill={color} />
      <circle cx="19" cy="12" r="1.3" fill={color} />
    </svg>
  );
}

export function PlusIcon({ size = 20, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ChevronIcon({ size = 18, color = "currentColor", style, dir = "start" }: IconProps & { dir?: "start" | "end" | "down" }) {
  const d = dir === "down" ? "M6 9l6 6 6-6" : dir === "start" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6";
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d={d} />
    </svg>
  );
}

export function PencilIcon({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M4 20l.9-3.9L15.5 5.5a1.7 1.7 0 0 1 2.4 0l.6.6a1.7 1.7 0 0 1 0 2.4L8 19.1z" />
      <path d="M14 7l3 3" />
    </svg>
  );
}

export function SearchIcon({ size = 18, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </svg>
  );
}

export function WalletIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h11A2 2 0 0 1 18.5 7.5V8h-13z" />
      <rect x="3.5" y="8" width="17" height="11" rx="2" />
      <circle cx="16" cy="13.5" r="1.2" fill={color} />
    </svg>
  );
}

export function LockIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <rect x="5" y="10.5" width="14" height="9" rx="2" />
      <path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" />
    </svg>
  );
}

export function GlobeIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5z" />
    </svg>
  );
}

export function CloudIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M7.5 18h9.5a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6-1.6A3.8 3.8 0 0 0 7.5 18z" />
    </svg>
  );
}

export function InfoIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.9" fill={color} />
    </svg>
  );
}

export function LogOutIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M13.5 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6.5" />
      <path d="M10.5 12h9.5M17 8.5l3.5 3.5-3.5 3.5" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.3 10.8 15l5-6" />
    </svg>
  );
}

export function AlertIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17" r="0.9" fill={color} />
    </svg>
  );
}

export function CameraIcon({ size = 20, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.8l1-1.7h7.4L16.7 7h1.8A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="13" r="3.3" />
    </svg>
  );
}

export function CrownIcon({ size = 20, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M4 17h16l-1.4-8-4.1 3.4L12 6l-2.5 6.4L5.4 9z" />
      <path d="M5.3 19.5h13.4" />
    </svg>
  );
}
