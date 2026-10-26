// Server-only: looks up the latest published GitHub release so the site picks up new versions by itself.

import { PRODUCT, type Release } from "@/config/product";

const REPO = new URL(PRODUCT.github).pathname.slice(1); // "owner/repo"
const RECHECK_SECONDS = 3600;

interface GitHubRelease {
  tag_name: string;
  assets: { name: string; size: number; browser_download_url: string }[];
}

/**
 * The latest published (non-draft, non-prerelease) release, re-checked at most once an hour.
 * Returns null when GitHub can't be reached, so callers fall back to the version in PRODUCT.
 */
export async function getLatestRelease(): Promise<Release | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "postcompass-website",
        // Optional: a token raises GitHub's rate limit; the site works without one
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: RECHECK_SECONDS },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GitHubRelease;
    return {
      version: data.tag_name.replace(/^v/, ""),
      assets: Object.fromEntries(data.assets.map((a) => [a.name, { url: a.browser_download_url, size: a.size }])),
    };
  } catch {
    return null;
  }
}
