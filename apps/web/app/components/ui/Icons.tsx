// SVG Icon components used across the website.
// Using inline SVGs instead of an icon library to minimize dependencies.

import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

/** Platform icons take `brand` to show in the platform's own color instead of the text color. */
interface PlatformIconProps extends IconProps {
  brand?: boolean;
}

const defaultProps: Required<Omit<IconProps, "style">> = {
  size: 20,
  className: "",
  strokeWidth: 2,
};

function makeIcon(
  paths: React.ReactNode,
  viewBox = "0 0 24 24"
): React.FC<IconProps> {
  const Icon: React.FC<IconProps> = (props) => {
    const { size, className, strokeWidth } = { ...defaultProps, ...props };
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={props.style}
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };
  Icon.displayName = "Icon";
  return Icon;
}

export const ChevronDown = makeIcon(
  <polyline points="6 9 12 15 18 9" />
);

export const ChevronRight = makeIcon(
  <polyline points="9 18 15 12 9 6" />
);

export const ArrowRight = makeIcon(
  <>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </>
);

export const Search = makeIcon(
  <>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </>
);

export const X = makeIcon(
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>
);

export const Menu = makeIcon(
  <>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </>
);

export const Download = makeIcon(
  <>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </>
);

export const ExternalLink = makeIcon(
  <>
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </>
);

export const Github = makeIcon(
  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
);

export const Copy = makeIcon(
  <>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </>
);

export const Check = makeIcon(
  <polyline points="20 6 9 17 4 12" />
);

export const Zap = makeIcon(
  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
);

export const Bug = makeIcon(
  <>
    <path d="m8 2 1.88 1.88" />
    <path d="M14.12 3.88 16 2" />
    <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
    <path d="M12 20v-9" />
    <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
    <path d="M6 13H2" />
    <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
    <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
    <path d="M22 13h-4" />
    <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
  </>
);

export const Gauge = makeIcon(
  <>
    <path d="m12 14 4-10" />
    <path d="M3.34 19a10 10 0 1 1 17.32 0" />
  </>
);

export const Users = makeIcon(
  <>
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </>
);

export const ArrowRightLeft = makeIcon(
  <>
    <path d="m16 3 4 4-4 4" />
    <path d="M20 7H4" />
    <path d="m8 21-4-4 4-4" />
    <path d="M4 17h16" />
  </>
);

export const Database = makeIcon(
  <>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14a9 3 0 0018 0V5" />
    <path d="M3 12a9 3 0 0018 0" />
  </>
);

export const Table = makeIcon(
  <>
    <path d="M12 3v18" />
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
  </>
);

export const Code = makeIcon(
  <>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </>
);

export const Settings = makeIcon(
  <>
    <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </>
);

export const Columns = makeIcon(
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <line x1="12" y1="3" x2="12" y2="21" />
  </>
);

export const Filter = makeIcon(
  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
);

export const Eye = makeIcon(
  <>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </>
);

export const FileJson = makeIcon(
  <>
    <path d="M15 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7z" />
    <path d="M14 2v4a2 2 0 002 2h4" />
    <path d="M10 12a1 1 0 00-1 1v1a1 1 0 01-1 1 1 1 0 011 1v1a1 1 0 001 1" />
    <path d="M14 18a1 1 0 001-1v-1a1 1 0 011-1 1 1 0 01-1-1v-1a1 1 0 00-1-1" />
  </>
);

export const Upload = makeIcon(
  <>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </>
);

export const Shield = makeIcon(
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
);

export const Globe = makeIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </>
);

export const Terminal = makeIcon(
  <>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </>
);

export const Sparkles = makeIcon(
  <>
    <path d="m12 3-1.912 5.813a2 2 0 01-1.275 1.275L3 12l5.813 1.912a2 2 0 011.275 1.275L12 21l1.912-5.813a2 2 0 011.275-1.275L21 12l-5.813-1.912a2 2 0 01-1.275-1.275L12 3z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </>
);

export const BookOpen = makeIcon(
  <>
    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
    <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
  </>
);

export const MessageSquare = makeIcon(
  <>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </>
);

export const GitBranch = makeIcon(
  <>
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 01-9 9" />
  </>
);

export const Layers = makeIcon(
  <>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </>
);

export const Activity = makeIcon(
  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
);

export const Lock = makeIcon(
  <>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </>
);

export const Compass = makeIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </>
);

// Platform-specific icons (filled, not stroked)
export const WindowsIcon: React.FC<PlatformIconProps> = ({
  size = 20,
  className = "",
  brand = false,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={brand ? `text-os-windows ${className}` : className}
    aria-hidden="true"
  >
    {/* The current Windows logo: four equal squares */}
    <path d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z" />
  </svg>
);

export const AppleIcon: React.FC<PlatformIconProps> = ({
  size = 20,
  className = "",
  brand = false,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={brand ? `text-os-macos ${className}` : className}
    aria-hidden="true"
  >
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

export const LinuxIcon: React.FC<PlatformIconProps> = ({
  size = 20,
  className = "",
  brand = false,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={brand ? `text-os-linux ${className}` : className}
    aria-hidden="true"
  >
    {/* Simple penguin silhouette: body with belly and eyes cut out, plus feet */}
    <path
      fillRule="evenodd"
      d="M12 2c-2.4 0-4 2-4 4.6 0 1.3-.4 2.3-1.2 3.6C5.6 12.1 4.5 14 4.5 16.2c0 2.9 3.2 4.8 7.5 4.8s7.5-1.9 7.5-4.8c0-2.2-1.1-4.1-2.3-6-.8-1.3-1.2-2.3-1.2-3.6C16 4 14.4 2 12 2Zm0 9.6c-1.9 0-3.3 1.8-3.3 4s1.4 4 3.3 4 3.3-1.8 3.3-4-1.4-4-3.3-4ZM10.6 5.6a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6Zm2.8 0a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6Z"
    />
    <ellipse cx="7.8" cy="20.7" rx="2.7" ry="1.3" />
    <ellipse cx="16.2" cy="20.7" rx="2.7" ry="1.3" />
  </svg>
);

export const Cloud = makeIcon(
  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
);

export const Play = makeIcon(
  <polygon points="6 3 20 12 6 21 6 3" />
);

export const RefreshCw = makeIcon(
  <>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </>
);

export const Plus = makeIcon(
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>
);

export const Trash = makeIcon(
  <>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </>
);

export const ArrowUpRight = makeIcon(
  <>
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </>
);

export const Server = makeIcon(
  <>
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </>
);

export const Cpu = makeIcon(
  <>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" />
    <line x1="15" y1="1" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="23" />
    <line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" />
    <line x1="20" y1="14" x2="23" y2="14" />
    <line x1="1" y1="9" x2="4" y2="9" />
    <line x1="1" y1="14" x2="4" y2="14" />
  </>
);

export const AwsLogo: React.FC<IconProps> = ({
  size = 20,
  className = "",
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={style}
    aria-hidden="true"
  >
    <path d="M18.75 14.28c-1.89 1.4-4.5 2.16-7.38 2.16-4.14 0-7.86-1.57-10.68-4.19-.22-.2-.02-.5.23-.35 3.03 1.83 6.81 2.94 10.74 2.94 2.56 0 5.31-.59 7.76-1.78.37-.18.66.27.33.52z" />
    <path d="M19.78 13.06c-.24-.31-1.58-.15-2.18-.08-.18.02-.21-.13-.05-.24 1.05-.72 2.76-.51 3.03-.18.27.33-.07 2.05-1.07 2.86-.15.12-.29.06-.23-.1.21-.56.74-1.95.5-2.26z" />
    <path d="M12.94 4.07c-1.39 0-2.3.93-2.3 2.18 0 1.28.91 2.17 2.3 2.17 1.4 0 2.3-.89 2.3-2.17 0-1.25-.9-2.18-2.3-2.18zm0 3.32c-.74 0-1.22-.5-1.22-1.14 0-.65.48-1.15 1.22-1.15.74 0 1.22.5 1.22 1.15 0 .64-.48 1.14-1.22 1.14z" />
  </svg>
);

// Map icon names to components
export const iconMap: Record<string, React.FC<IconProps>> = {
  zap: Zap,
  bug: Bug,
  gauge: Gauge,
  users: Users,
  "arrow-right-left": ArrowRightLeft,
  download: Download,
  database: Database,
  table: Table,
  code: Code,
  settings: Settings,
  columns: Columns,
  filter: Filter,
  eye: Eye,
  "file-json": FileJson,
  upload: Upload,
  shield: Shield,
  globe: Globe,
  terminal: Terminal,
  sparkles: Sparkles,
  "book-open": BookOpen,
  "message-square": MessageSquare,
  "git-branch": GitBranch,
  layers: Layers,
  activity: Activity,
  lock: Lock,
  compass: Compass,
  cloud: Cloud,
  play: Play,
  "refresh-cw": RefreshCw,
  server: Server,
  cpu: Cpu,
};
