"use client";

import { useState, useEffect, useCallback } from "react";
import { PRODUCT } from "../config/product";
import {
  Download,
  Github,
  Menu,
  X,
  Compass,
  WindowsIcon,
  AppleIcon,
  LinuxIcon,
  Sparkles,
} from "./Icons";
import styles from "./Navbar.module.css";

type Platform = "windows" | "macos" | "linux";

const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  { label: "Cloud Postgres", href: "#cloud-postgres", isLive: true },
  { label: "Early Access", href: "#waitlist", isWaitlist: true },
  { label: "Download", href: "/download" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [detectedOs, setDetectedOs] = useState<Platform>("windows");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("win")) {
        setDetectedOs("windows");
      } else if (ua.includes("linux")) {
        setDetectedOs("linux");
      } else if (ua.includes("mac")) {
        setDetectedOs("macos");
      }
    }
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const osLabel =
    detectedOs === "windows"
      ? "Windows"
      : detectedOs === "macos"
        ? "macOS"
        : "Linux";

  const PlatformIcon =
    detectedOs === "windows"
      ? WindowsIcon
      : detectedOs === "macos"
        ? AppleIcon
        : LinuxIcon;

  return (
    <div className={styles.headerWrapper}>
      <header
        className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}
        role="banner"
      >
        <nav className={styles.nav} aria-label="Main navigation">
          {/* Brand Logo & Tech Pill */}
          <div className={styles.brandGroup}>
            <a href="#" className={styles.logo} aria-label={`${PRODUCT.name} home`}>
              <div className={styles.logoIconWrap}>
                <Compass size={18} className={styles.logoIcon} />
              </div>
              <span className={styles.logoText}>{PRODUCT.name}</span>
            </a>
            <span className={styles.versionBadge}>
              <span className={styles.versionDot} />
              <span>v0.4.2</span>
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <ul className={styles.links} role="list">
            {NAV_ITEMS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={`${styles.link} ${link.isWaitlist ? styles.linkHighlight : ""}`}
                >
                  {link.isLive && <span className={styles.livePulseDot} />}
                  <span>{link.label}</span>
                </a>
              </li>
            ))}
          </ul>

          {/* Action Buttons: GitHub Star & Glass Waitlist / Download */}
          <div className={styles.actions}>
            <a
              href={PRODUCT.github}
              className={styles.githubBtn}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Star PostCompass on GitHub"
            >
              <Github size={14} />
              <span className={styles.githubLabel}>Star</span>
              <span className={styles.githubStarCount}>4.2k</span>
            </a>

            <a href="#waitlist" className={styles.waitlistBtn}>
              <Sparkles size={13} />
              <span>Early Access</span>
            </a>

            <button
              className={styles.menuToggle}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Drawer Overlay */}
      <div
        className={`${styles.mobileOverlay} ${mobileOpen ? styles.mobileOverlayOpen : ""}`}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Mobile Drawer Menu */}
      <div
        className={`${styles.mobileMenu} ${mobileOpen ? styles.mobileMenuOpen : ""}`}
        role="dialog"
        aria-label="Mobile navigation menu"
      >
        <div className={styles.mobileMenuInner}>
          <div className={styles.mobileNavLinks}>
            {NAV_ITEMS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={styles.mobileNavLink}
                onClick={closeMobile}
              >
                <div className={styles.mobileNavLinkTitle}>
                  {link.isLive && <span className={styles.livePulseDot} />}
                  <span>{link.label}</span>
                </div>
                <span className={styles.mobileNavChevron}>→</span>
              </a>
            ))}
          </div>

          <div className={styles.mobileMenuDivider} />

          <div className={styles.mobileActions}>
            <a
              href="#waitlist"
              className={styles.mobileWaitlistBtn}
              onClick={closeMobile}
            >
              <Sparkles size={15} />
              <span>Join Priority Waitlist</span>
            </a>

            <a
              href="/download"
              className={styles.mobileDownloadBtn}
              onClick={closeMobile}
            >
              <PlatformIcon size={15} />
              <span>Download for {osLabel}</span>
            </a>

            <a
              href={PRODUCT.github}
              className={styles.mobileGithubBtn}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMobile}
            >
              <Github size={15} />
              <span>Star on GitHub (4.2k)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
