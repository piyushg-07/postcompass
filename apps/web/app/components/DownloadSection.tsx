"use client";

import { useEffect, useState } from "react";
import { DOWNLOADS, PRODUCT, RELEASES_URL, assetUrl, detectPlatform, type Platform } from "../config/product";
import { WindowsIcon, AppleIcon, LinuxIcon, Download, ArrowUpRight } from "./Icons";
import styles from "./DownloadSection.module.css";

const ICONS = { windows: WindowsIcon, macos: AppleIcon, linux: LinuxIcon };

export default function DownloadSection({ asPage = false }: { asPage?: boolean }) {
  const [detected, setDetected] = useState<Platform | null>(null);

  useEffect(() => {
    setDetected(detectPlatform(navigator.userAgent));
  }, []);

  const Heading = asPage ? "h1" : "h2";

  return (
    <section className={`section ${asPage ? styles.page : ""}`} id="download">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Download · v{PRODUCT.version}</span>
          <Heading className="section-title">Get PostCompass</Heading>
          <p className="section-description">
            Free and open source. Pick the installer for your system.
          </p>
        </div>

        <div className={styles.grid}>
          {DOWNLOADS.map((d) => {
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
                  <a href={assetUrl(primary.file)} className={`${styles.primary} ${isDetected ? styles.primaryHot : ""}`}>
                    <Download size={15} />
                    <span>{primary.label}</span>
                    {primary.size && <span className={styles.size}>{primary.size}</span>}
                  </a>
                )}

                <ul className={styles.assets}>
                  {rest.map((a) => (
                    <li key={a.file}>
                      <a href={assetUrl(a.file)} className={styles.asset}>
                        <span className={styles.assetLabel}>{a.label}</span>
                        <span className={styles.assetNote}>{a.note}</span>
                        {a.size && <span className={styles.size}>{a.size}</span>}
                        <Download size={13} className={styles.assetIcon} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className={styles.notes}>
          <p>
            <strong>Not code-signed yet.</strong> On Windows choose <em>More info → Run anyway</em>; on macOS right-click
            the app and choose <em>Open</em> the first time.
          </p>
          <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className={styles.allReleases}>
            All releases and release notes <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}
