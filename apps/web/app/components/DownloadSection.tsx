"use client";

import { useEffect, useState } from "react";
import {
  PRODUCT,
  DOWNLOADS,
  type Platform,
  type DownloadOption,
} from "../config/product";
import {
  WindowsIcon,
  AppleIcon,
  LinuxIcon,
  Download,
  ExternalLink,
} from "./Icons";
import styles from "./DownloadSection.module.css";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "windows";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "windows";
}

const platformIcons: Record<Platform, React.FC<{ size?: number; className?: string }>> = {
  windows: WindowsIcon,
  macos: AppleIcon,
  linux: LinuxIcon,
};

export default function DownloadSection() {
  const [activePlatform, setActivePlatform] = useState<Platform>("windows");

  useEffect(() => {
    setActivePlatform(detectPlatform());
  }, []);

  const sorted = [...DOWNLOADS].sort((a, b) => {
    if (a.platform === activePlatform) return -1;
    if (b.platform === activePlatform) return 1;
    return 0;
  });

  return (
    <section className="section" id="download">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Downloads</span>
          <h2 className="section-title">
            Download PostCompass
          </h2>
          <p className="section-description">
            Available as a native desktop application for all major operating
            systems. No browser, no Docker, no cloud signup.
          </p>
        </div>

        {/* Platform tabs */}
        <div className={styles.tabs} role="tablist">
          {DOWNLOADS.map((dl) => {
            const Icon = platformIcons[dl.platform];
            return (
              <button
                key={dl.platform}
                className={`${styles.tab} ${activePlatform === dl.platform ? styles.active : ""}`}
                onClick={() => setActivePlatform(dl.platform)}
                role="tab"
                aria-selected={activePlatform === dl.platform}
                aria-controls={`panel-${dl.platform}`}
              >
                <Icon size={18} />
                {dl.label}
                {activePlatform === dl.platform && (
                  <span className={styles.recommended}>Detected</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Download cards */}
        <div className={styles.cards}>
          {sorted.map((dl) => (
            <DownloadCard
              key={dl.platform}
              download={dl}
              isActive={dl.platform === activePlatform}
            />
          ))}
        </div>

        {/* Release info */}
        <div className={styles.releaseInfo}>
          <div className={styles.releaseRow}>
            <span className={styles.releaseLabel}>Version</span>
            <span className={styles.releaseValue}>
              v{PRODUCT.version}
            </span>
          </div>
          <span className={styles.releaseSep}>·</span>
          <div className={styles.releaseRow}>
            <span className={styles.releaseLabel}>License</span>
            <span className={styles.releaseValue}>{PRODUCT.license}</span>
          </div>
          <span className={styles.releaseSep}>·</span>
          <a href={`${PRODUCT.github}/releases`} className={styles.allReleases} target="_blank" rel="noopener noreferrer">
            All releases <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </section>
  );
}

function DownloadCard({
  download,
  isActive,
}: {
  download: DownloadOption;
  isActive: boolean;
}) {
  const Icon = platformIcons[download.platform];

  return (
    <div
      className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
      id={`panel-${download.platform}`}
      role="tabpanel"
    >
      <div className={styles.cardHeader}>
        <Icon size={32} className={styles.cardIcon} />
        <div>
          <h3 className={styles.cardTitle}>{download.label}</h3>
          <p className={styles.cardArch}>{download.primary.arch}</p>
        </div>
      </div>

      <div className={styles.cardActions}>
        <a
          href={download.primary.url}
          className="btn btn-primary"
          style={{ width: "100%" }}
        >
          <Download size={16} />
          {download.primary.label}
          <span className={styles.format}>{download.primary.format}</span>
        </a>

        {download.secondary && (
          <a
            href={download.secondary.url}
            className="btn btn-secondary"
            style={{ width: "100%" }}
          >
            <Download size={14} />
            {download.secondary.label}
            <span className={styles.format}>
              {download.secondary.format}
            </span>
          </a>
        )}
      </div>

      <p className={styles.cardNote}>
        v{PRODUCT.version} · {download.primary.format} · {download.primary.arch}
      </p>
    </div>
  );
}
