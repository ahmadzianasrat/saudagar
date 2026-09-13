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

export function StoreIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M4 9.5 5.2 4.5h13.6L20 9.5" />
      <path d="M4 9.5a2.3 2.3 0 0 0 4.4 1 2.3 2.3 0 0 0 4.4 0 2.3 2.3 0 0 0 4.4 0 2.3 2.3 0 0 0 4.4-1" />
      <path d="M5.5 11v8.5h13V11" />
      <path d="M10 19.5V15h4v4.5" />
    </svg>
  );
}

export function GridIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
}

export function ClipboardIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <rect x="5.5" y="5" width="13" height="16" rx="2" />
      <path d="M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4.5" />
    </svg>
  );
}

export function CreditCardIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <rect x="3" y="6" width="18" height="13" rx="2.2" />
      <path d="M3 10h18" />
      <path d="M6.5 14.5h4" />
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

export function TrendingIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M3.5 16.5 9.5 10l4 4 6.5-7.5" />
      <path d="M15.5 6h4.5v4.5" />
    </svg>
  );
}

export function ShieldIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M12 3.5 19 6v6c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6z" />
      <path d="M9 12l2 2 4-4.3" />
    </svg>
  );
}

export function MenuIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
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

export function ChevronIcon({ size = 18, color = "currentColor", style, dir = "start" }: IconProps & { dir?: "start" | "end" | "down" }) {
  const d = dir === "down" ? "M6 9l6 6 6-6" : dir === "start" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6";
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d={d} />
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

export function PlusIcon({ size = 18, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function EyeIcon({ size = 18, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function ClockIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.3l3.5 2" />
    </svg>
  );
}

export function MailIcon({ size = 18, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 6.5 12 13l8.5-6.5" />
    </svg>
  );
}

export function LockIcon({ size = 18, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <rect x="5" y="10.5" width="14" height="9" rx="2" />
      <path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" />
    </svg>
  );
}

export function UserPlusIcon({ size = 18, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <circle cx="9.5" cy="8.5" r="3.3" />
      <path d="M3.5 19.5c0-3.3 2.7-5.7 6-5.7s6 2.4 6 5.7" />
      <path d="M18.5 8v5M16 10.5h5" />
    </svg>
  );
}

export function CheckIcon({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </svg>
  );
}

export function XIcon({ size = 16, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function MoreIcon({ size = 22, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <circle cx="5" cy="12" r="1.3" fill={color} />
      <circle cx="12" cy="12" r="1.3" fill={color} />
      <circle cx="19" cy="12" r="1.3" fill={color} />
    </svg>
  );
}

export function PhoneIcon({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg {...base(size)} stroke={color} style={style}>
      <path d="M6.5 4h3l1.3 4-2 1.5a12 12 0 0 0 5.7 5.7l1.5-2 4 1.3v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4z" />
    </svg>
  );
}
