// PostCompass — product facts used across the site. Keep these accurate.

export const PRODUCT = {
  name: "PostCompass",
  tagline: "A fast, modern desktop app for PostgreSQL",
  description:
    "Spin up a local PostgreSQL database in one click, connect to any cloud, and browse, edit and query your data in one fast native app. Free and open source.",
  // Fallback only: the site shows the latest GitHub release when it can reach GitHub (see release.ts)
  version: "0.1.0",
  license: "MIT",
  github: "https://github.com/piyushg-07/postcompass",
  website: "https://www.postcompass.cloud",
} as const;

/** Cloud providers with presets in the app's connection dialog. Keep in sync with the desktop app. */
export const CLOUD_PROVIDERS = [
  "AWS RDS / Aurora",
  "Google Cloud SQL",
  "Azure Database for PostgreSQL",
  "Alibaba Cloud",
  "Oracle Cloud",
  "DigitalOcean",
  "Heroku Postgres",
  "Neon",
  "Railway",
  "Render",
] as const;

export const RELEASES_URL = `${PRODUCT.github}/releases`;
export const LATEST_RELEASE_URL = `${PRODUCT.github}/releases/latest`;

// The demo video lives in Vercel Blob storage (kept out of the repo) and plays in the site's own player
export const DEMO_VIDEO_URL = "https://8wsuxgiwn8vrlgqs.public.blob.vercel-storage.com/PostCompass-demo-hook.mp4";

export type Platform = "windows" | "macos" | "linux";

export interface ReleaseAsset {
  label: string;
  note: string;
  url: string;
  size?: string;
}

export interface PlatformDownloads {
  platform: Platform;
  name: string;
  requirement: string;
  assets: ReleaseAsset[];
}

/** A published release as the site needs it: its version and its files by name. */
export interface Release {
  version: string;
  assets: Record<string, { url: string; size: number }>;
}

interface AssetTemplate {
  label: string;
  note: string;
  /** File name for a version, matching what the release workflow (tauri-action) uploads */
  file: (version: string) => string;
  /** Size of the fallback version's file, shown when GitHub can't be reached */
  size?: string;
}

const PLATFORMS: (Omit<PlatformDownloads, "assets"> & { assets: AssetTemplate[] })[] = [
  {
    platform: "windows",
    name: "Windows",
    requirement: "Windows 10 or 11, 64-bit",
    assets: [
      { label: "Installer (.exe)", file: (v) => `PostCompass_${v}_x64-setup.exe`, note: "Recommended", size: "3.3 MB" },
      { label: "MSI package", file: (v) => `PostCompass_${v}_x64_en-US.msi`, note: "For managed installs", size: "4.6 MB" },
    ],
  },
  {
    platform: "macos",
    name: "macOS",
    requirement: "Apple Silicon and Intel",
    assets: [
      { label: "Apple Silicon (.dmg)", file: (v) => `PostCompass_${v}_aarch64.dmg`, note: "M1 and newer", size: "4.2 MB" },
      { label: "Intel (.dmg)", file: (v) => `PostCompass_${v}_x64.dmg`, note: "Intel Macs" },
    ],
  },
  {
    platform: "linux",
    name: "Linux",
    requirement: "64-bit (x86_64)",
    assets: [
      { label: "AppImage", file: (v) => `PostCompass_${v}_amd64.AppImage`, note: "Any distribution", size: "81 MB" },
      { label: ".deb", file: (v) => `PostCompass_${v}_amd64.deb`, note: "Ubuntu, Debian", size: "4.8 MB" },
      { label: ".rpm", file: (v) => `PostCompass-${v}-1.x86_64.rpm`, note: "Fedora, RHEL", size: "4.8 MB" },
    ],
  },
];

const formatSize = (bytes: number) => `${(bytes / 1048576).toFixed(bytes < 10 * 1048576 ? 1 : 0)} MB`;

/**
 * Download links for the latest release. With a release from GitHub, links and sizes come from its real files
 * (any file a build didn't produce is left out); without one, they point at PRODUCT.version.
 */
export function getDownloads(release: Release | null): { version: string; platforms: PlatformDownloads[] } {
  const version = release?.version ?? PRODUCT.version;
  const platforms = PLATFORMS.map((p) => {
    const assets: ReleaseAsset[] = [];
    for (const a of p.assets) {
      const file = a.file(version);
      if (!release) {
        assets.push({ label: a.label, note: a.note, url: `${PRODUCT.github}/releases/download/v${version}/${file}`, size: a.size });
        continue;
      }
      const live = release.assets[file];
      if (live) assets.push({ label: a.label, note: a.note, url: live.url, size: formatSize(live.size) });
    }
    if (!assets.length) assets.push({ label: "See all releases", note: "", url: LATEST_RELEASE_URL });
    return { platform: p.platform, name: p.name, requirement: p.requirement, assets };
  });
  return { version, platforms };
}

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
      "Yes. It's open source under the MIT license, with no paid tier, no account and no sign-up.",
  },
  {
    question: "Do I need to install PostgreSQL or Docker first?",
    answer:
      "No. PostCompass downloads the official PostgreSQL binaries, verifies them and runs the server for you, with no admin rights needed.",
  },
  {
    question: "What can I connect to?",
    answer:
      "Local PostgreSQL 14 to 18, PostgreSQL already running on your computer, and any remote PostgreSQL server, with presets for AWS RDS, Google Cloud SQL, Azure, Alibaba Cloud, Oracle Cloud, DigitalOcean, Heroku, Neon, Railway and Render.",
  },
  {
    question: "Is it safe to use on a production database?",
    answer:
      "Yes. The SQL editor warns before destructive queries, EXPLAIN ANALYZE is always rolled back, and connections can require TLS with certificate verification.",
  },
  {
    question: "Is my data private?",
    answer:
      "Yes. There's no telemetry, passwords live in your system keychain, and local servers only listen on 127.0.0.1.",
  },
  {
    question: "Which operating systems does PostCompass support?",
    answer:
      "Windows 10 and 11 (64-bit), macOS on Apple Silicon and Intel, and 64-bit Linux as an AppImage, .deb or .rpm. PostCompass picks the right PostgreSQL build for your system automatically.",
  },
  {
    question: "How is PostCompass different from pgAdmin?",
    answer:
      "PostCompass is a native desktop app focused on everyday work: it can install and run PostgreSQL for you, edits tables like a spreadsheet and shows query plans visually. pgAdmin is a long-standing, full-featured administration tool. Both are free and open source.",
  },
  {
    question: "Why does my system warn me when I install it?",
    answer:
      "The installers aren't code-signed yet. On Windows choose More info, then Run anyway. On macOS, open Privacy & Security in System Settings and click Open Anyway.",
  },
] as const;
