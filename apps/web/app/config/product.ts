// PostCompass — product facts used across the site. Keep these accurate.

export const PRODUCT = {
  name: "PostCompass",
  tagline: "A fast, modern desktop app for PostgreSQL",
  description:
    "Spin up a local PostgreSQL database in one click, connect to any cloud, and browse, edit and query your data in one fast native app. Free and open source.",
  version: "0.1.0",
  license: "MIT",
  github: "https://github.com/piyushg-07/postcompass",
  website: "https://postcompass.dev",
} as const;

export const RELEASES_URL = `${PRODUCT.github}/releases`;
export const LATEST_RELEASE_URL = `${PRODUCT.github}/releases/latest`;

// The demo video lives on Google Drive; /preview is Drive's embeddable player
export const DEMO_VIDEO_EMBED_URL = "https://drive.google.com/file/d/1Jdj9k6L8SMpCTW82rI-g6frQwZZrUuWB/preview";

export type Platform = "windows" | "macos" | "linux";

export interface ReleaseAsset {
  label: string;
  file: string;
  note: string;
  size?: string;
}

export interface PlatformDownloads {
  platform: Platform;
  name: string;
  requirement: string;
  assets: ReleaseAsset[];
}

const v = PRODUCT.version;
export const assetUrl = (file: string) => `${PRODUCT.github}/releases/download/v${v}/${file}`;

// File names match what the release workflow (tauri-action) uploads for each version.
export const DOWNLOADS: PlatformDownloads[] = [
  {
    platform: "windows",
    name: "Windows",
    requirement: "Windows 10 or 11, 64-bit",
    assets: [
      { label: "Installer (.exe)", file: `PostCompass_${v}_x64-setup.exe`, note: "Recommended", size: "3.3 MB" },
      { label: "MSI package", file: `PostCompass_${v}_x64_en-US.msi`, note: "For managed installs", size: "4.6 MB" },
    ],
  },
  {
    platform: "macos",
    name: "macOS",
    requirement: "Apple Silicon and Intel",
    assets: [
      { label: "Apple Silicon (.dmg)", file: `PostCompass_${v}_aarch64.dmg`, note: "M1 and newer", size: "4.2 MB" },
      { label: "Intel (.dmg)", file: `PostCompass_${v}_x64.dmg`, note: "Intel Macs" },
    ],
  },
  {
    platform: "linux",
    name: "Linux",
    requirement: "64-bit (x86_64)",
    assets: [
      { label: "AppImage", file: `PostCompass_${v}_amd64.AppImage`, note: "Any distribution", size: "81 MB" },
      { label: ".deb", file: `PostCompass_${v}_amd64.deb`, note: "Ubuntu, Debian", size: "4.8 MB" },
      { label: ".rpm", file: `PostCompass-${v}-1.x86_64.rpm`, note: "Fedora, RHEL", size: "4.8 MB" },
    ],
  },
];

export function detectPlatform(userAgent: string): Platform {
  const ua = userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux") && !ua.includes("android")) return "linux";
  return "windows";
}

export const FAQ_ITEMS = [
  {
    question: "Is PostCompass really free?",
    answer:
      "Yes. PostCompass is open source under the MIT license. There's no paid tier, no account and no sign-up.",
  },
  {
    question: "Do I need to install PostgreSQL or Docker first?",
    answer:
      "No. New local database downloads the official PostgreSQL binaries for your platform, verifies their SHA-256 checksum and runs the server as your user, with no admin rights needed. If you already have PostgreSQL, connect to it like any other server.",
  },
  {
    question: "Which PostgreSQL versions and providers work?",
    answer:
      "Local servers can run PostgreSQL 14, 15, 16, 17 or 18. Remote connections work with any PostgreSQL, with presets for AWS RDS and Aurora, Google Cloud SQL, Azure, Supabase, Neon, Cloudflare Hyperdrive, Railway and Render.",
  },
  {
    question: "Where are my passwords stored?",
    answer:
      "In your operating system's keychain: Windows Credential Manager, macOS Keychain or the Linux Secret Service. They're never written to PostCompass's own files.",
  },
  {
    question: "Does PostCompass collect any data?",
    answer:
      "No. There's no telemetry and no account. The app talks only to your own databases; the one request it makes by itself is downloading PostgreSQL binaries when you create a local server.",
  },
  {
    question: "Why does my system warn me when I install it?",
    answer:
      "The installers aren't code-signed yet. On Windows choose More info, then Run anyway. On macOS, open System Settings, go to Privacy & Security and click Open Anyway the first time.",
  },
  {
    question: "Where do I report a bug or ask for a feature?",
    answer:
      "Open an issue or start a discussion on GitHub. Contributions are welcome too; the contributing guide covers setup and architecture.",
  },
] as const;
