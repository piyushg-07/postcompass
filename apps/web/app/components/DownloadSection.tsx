"use client";

import { useEffect, useState } from "react";
import { RELEASES_URL, detectPlatform, type Platform, type PlatformDownloads } from "../config/product";
import { WindowsIcon, AppleIcon, LinuxIcon, Download } from "./Icons";
import styles from "./DownloadSection.module.css";

const ICONS = { windows: WindowsIcon, macos: AppleIcon, linux: LinuxIcon };
interface Props {
  asPage?: boolean;
  downloads: { version: string; platforms: PlatformDownloads[] };
}

export default function DownloadSection({ asPage = false, downloads }: Props) {
  // Every card gets this many "other format" rows (empty ones are invisible) so all cards are the same height
  const extraRows = Math.max(...downloads.platforms.map((d) => d.assets.length - 1));
  const [detected, setDetected] = useState<Platform | null>(null);

  useEffect(() => {
    setDetected(detectPlatform(navigator.userAgent));
  }, []);

  const Heading = asPage ? "h1" : "h2";

  return (
    <section className={`section ${asPage ? styles.page : ""}`} id="download">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Download · v{downloads.version}</span>
          <Heading className="section-title">Get PostCompass</Heading>
          <p className="section-description">
            Free and open source. Pick the installer for your system.
          </p>
        </div>

        <div className={styles.grid}>
          {downloads.platforms.map((d) => {
            const Icon = ICONS[d.platform];
            const isDetected = detected === d.platform;
            const [primary, ...rest] = d.assets;
            return (
              <div key={d.platform} className={`${styles.card} ${isDetected ? styles.cardDetected : ""}`}>
                <div className={styles.cardHead}>
                  <span className={styles.osIcon}>
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3 className={styles.osName}>{d.name}</h3>
                    <p className={styles.osReq}>{d.requirement}</p>
                  </div>
                  {isDetected && <span className={styles.detected}>Your system</span>}
                </div>

                {primary && (
                  <a href={primary.url} className={`${styles.primary} ${isDetected ? styles.primaryHot : ""}`}>
                    <Download size={15} />
                    <span>{primary.label}</span>
                    {primary.size && <span className={styles.size}>{primary.size}</span>}
                  </a>
                )}

                <ul className={styles.assets}>
                  <li className={styles.assetsTitle} aria-hidden="true">
                    {rest.length === 1 ? "Also available" : "Other formats"}
                  </li>
                  {rest.map((a) => (
                    <li key={a.url}>
                      <a href={a.url} className={styles.asset}>
                        <span className={styles.assetLabel}>{a.label}</span>
                        <span className={styles.assetNote}>{a.note}</span>
                        {a.size && <span className={styles.size}>{a.size}</span>}
                        <Download size={13} className={styles.assetIcon} />
                      </a>
                    </li>
                  ))}
                  {Array.from({ length: extraRows - rest.length }, (_, i) => (
                    <li key={`spacer-${i}`} className={styles.assetSpacer} aria-hidden="true">
                      <span className={styles.asset}>&nbsp;</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className={styles.notes}>
          <p>
            <strong>Not code-signed yet.</strong> On first launch:
          </p>
          <span className={styles.tip}>
            <WindowsIcon size={13} />
            Click <em>More info</em>, then <em>Run anyway</em>
          </span>
          <span className={styles.tip}>
            <AppleIcon size={13} />
            In <em>Privacy &amp; Security</em>, click <em>Open Anyway</em>
          </span>
          <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className={styles.allReleases}>
            All releases
          </a>
        </div>
      </div>
    </section>
  );
}
