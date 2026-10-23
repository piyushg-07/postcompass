"use client";

import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { PRODUCT } from "../config/product";
import {
  WindowsIcon,
  AppleIcon,
  LinuxIcon,
  Download,
  Terminal,
  Check,
  Copy,
  Shield,
  Zap,
  Cpu,
  ChevronRight,
  Sparkles,
} from "../components/Icons";
import styles from "./download.module.css";

type Platform = "windows" | "macos" | "linux";

export default function DownloadPage() {
  const [detectedOs, setDetectedOs] = useState<Platform>("windows");
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("win")) setDetectedOs("windows");
      else if (ua.includes("linux")) setDetectedOs("linux");
      else if (ua.includes("mac")) setDetectedOs("macos");
    }
  }, []);

  const handleCopy = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.ambientGlow} />

        <div className={`container ${styles.container}`}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              <Sparkles size={14} />
              <span>Official Releases · v{PRODUCT.version}</span>
            </div>
            <h1 className={styles.title}>
              Download <span className={styles.titleGradient}>PostCompass</span>
            </h1>
            <p className={styles.subtitle}>
              Native desktop application for high-speed PostgreSQL management. Direct TCP connection with zero cloud proxy.
            </p>
          </div>

          {/* Platform Download Cards */}
          <div className={styles.cardsGrid}>
            {/* WINDOWS */}
            <div
              className={`${styles.card} ${detectedOs === "windows" ? styles.cardActive : ""}`}
            >
              {detectedOs === "windows" && (
                <div className={styles.detectedBadge}>Detected Your System</div>
              )}
              <div className={styles.cardHeader}>
                <div className={styles.cardIconWrap}>
                  <WindowsIcon size={26} className={styles.winIcon} />
                </div>
                <div>
                  <h2 className={styles.cardTitle}>Windows</h2>
                  <span className={styles.cardMeta}>Windows 10, 11 (64-bit &amp; ARM64)</span>
                </div>
              </div>

              <p className={styles.cardDesc}>
                Native Windows binary powered by Tauri and Rust. Integrates with Windows Credential Manager and WSL2.
              </p>

              <div className={styles.btnStack}>
                <a
                  href="#download-windows-exe"
                  className={styles.primaryBtn}
                  onClick={(e) => {
                    e.preventDefault();
                    alert("PostCompass v0.1.0 for Windows will begin downloading shortly.");
                  }}
                >
                  <Download size={16} />
                  <span>Download Installer (.exe)</span>
                </a>
                <a
                  href="#download-windows-msi"
                  className={styles.secondaryBtn}
                  onClick={(e) => {
                    e.preventDefault();
                    alert("PostCompass v0.1.0 MSI enterprise package will begin downloading shortly.");
                  }}
                >
                  <span>Enterprise Package (.msi)</span>
                </a>
              </div>

              <div className={styles.terminalBox}>
                <span className={styles.terminalPrompt}>$</span>
                <code className={styles.terminalCode}>winget install postcompass</code>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() => handleCopy("winget install postcompass", "win")}
                >
                  {copiedCmd === "win" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* MACOS */}
            <div
              className={`${styles.card} ${detectedOs === "macos" ? styles.cardActive : ""}`}
            >
              {detectedOs === "macos" && (
                <div className={styles.detectedBadge}>Detected Your System</div>
              )}
              <div className={styles.cardHeader}>
                <div className={styles.cardIconWrap}>
                  <AppleIcon size={26} className={styles.macIcon} />
                </div>
                <div>
                  <h2 className={styles.cardTitle}>macOS</h2>
                  <span className={styles.cardMeta}>macOS 12+ (Apple Silicon &amp; Intel)</span>
                </div>
              </div>

              <p className={styles.cardDesc}>
                Universal macOS application notarized by Apple. Optimized for Apple Silicon M-series chips with ultra-low memory footprint.
              </p>

              <div className={styles.btnStack}>
                <a
                  href="#download-macos-arm64"
                  className={styles.primaryBtn}
                  onClick={(e) => {
                    e.preventDefault();
                    alert("PostCompass for Apple Silicon (M1/M2/M3/M4) will begin downloading shortly.");
                  }}
                >
                  <Download size={16} />
                  <span>Apple Silicon (.dmg)</span>
                </a>
                <a
                  href="#download-macos-x64"
                  className={styles.secondaryBtn}
                  onClick={(e) => {
                    e.preventDefault();
                    alert("PostCompass for Intel Mac will begin downloading shortly.");
                  }}
                >
                  <span>Intel x64 (.dmg)</span>
                </a>
              </div>

              <div className={styles.terminalBox}>
                <span className={styles.terminalPrompt}>$</span>
                <code className={styles.terminalCode}>brew install --cask postcompass</code>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() => handleCopy("brew install --cask postcompass", "mac")}
                >
                  {copiedCmd === "mac" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* LINUX */}
            <div
              className={`${styles.card} ${detectedOs === "linux" ? styles.cardActive : ""}`}
            >
              {detectedOs === "linux" && (
                <div className={styles.detectedBadge}>Detected Your System</div>
              )}
              <div className={styles.cardHeader}>
                <div className={styles.cardIconWrap}>
                  <LinuxIcon size={26} className={styles.linuxIcon} />
                </div>
                <div>
                  <h2 className={styles.cardTitle}>Linux</h2>
                  <span className={styles.cardMeta}>Ubuntu, Debian, Fedora, Arch</span>
                </div>
              </div>

              <p className={styles.cardDesc}>
                Standalone AppImage and Debian packages. Direct native Wayland and X11 rendering with zero Electron overhead.
              </p>

              <div className={styles.btnStack}>
                <a
                  href="#download-linux-appimage"
                  className={styles.primaryBtn}
                  onClick={(e) => {
                    e.preventDefault();
                    alert("PostCompass AppImage will begin downloading shortly.");
                  }}
                >
                  <Download size={16} />
                  <span>Universal AppImage</span>
                </a>
                <a
                  href="#download-linux-deb"
                  className={styles.secondaryBtn}
                  onClick={(e) => {
                    e.preventDefault();
                    alert("PostCompass .deb package will begin downloading shortly.");
                  }}
                >
                  <span>Debian / Ubuntu (.deb)</span>
                </a>
              </div>

              <div className={styles.terminalBox}>
                <span className={styles.terminalPrompt}>$</span>
                <code className={styles.terminalCode}>curl -fsSL https://postcompass.dev/install.sh | bash</code>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() =>
                    handleCopy(
                      "curl -fsSL https://postcompass.dev/install.sh | bash",
                      "linux"
                    )
                  }
                >
                  {copiedCmd === "linux" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Cargo / CLI Section */}
          <div className={styles.cargoSection}>
            <div className={styles.cargoHeader}>
              <div className={styles.cargoIconWrap}>
                <Terminal size={20} />
              </div>
              <div>
                <h3 className={styles.cargoTitle}>Rust &amp; Cargo Package</h3>
                <p className={styles.cargoDesc}>
                  Compile PostCompass directly from source via crates.io.
                </p>
              </div>
            </div>
            <div className={styles.cargoCmdBox}>
              <code>cargo install postcompass-desktop</code>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={() => handleCopy("cargo install postcompass-desktop", "cargo")}
              >
                {copiedCmd === "cargo" ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Security & Verification Banner */}
          <div className={styles.trustBanner}>
            <div className={styles.trustItem}>
              <Shield size={16} className={styles.trustIcon} />
              <span>100% Local-First (No Telemetry or SaaS proxy)</span>
            </div>
            <div className={styles.trustItem}>
              <Zap size={16} className={styles.trustIcon} />
              <span>Direct TCP/SSL to AWS, Supabase, Neon &amp; GCP</span>
            </div>
            <div className={styles.trustItem}>
              <Cpu size={16} className={styles.trustIcon} />
              <span>Tauri + Rust (14.2 MB RAM usage)</span>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
