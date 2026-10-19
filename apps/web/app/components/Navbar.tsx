"use client";

import { useState, useEffect, useCallback } from "react";
import { PRODUCT, NAV_LINKS } from "../config/product";
import { Download, Github, Menu, X, Compass } from "./Icons";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  return (
    <header
      className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}
      role="banner"
    >
      <nav className={`${styles.nav} container`} aria-label="Main navigation">
        <a href="#" className={styles.logo} aria-label={`${PRODUCT.name} home`}>
          <Compass size={28} className={styles.logoIcon} />
          <span className={styles.logoText}>{PRODUCT.name}</span>
        </a>

        <ul className={styles.links} role="list">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className={styles.link}>
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href={PRODUCT.github}
              className={styles.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={16} />
              GitHub
            </a>
          </li>
        </ul>

        <div className={styles.actions}>
          <a href="#download" className="btn btn-primary btn-sm">
            <Download size={14} />
            Download
          </a>
          <button
            className={`${styles.menuBtn} btn-icon btn-ghost`}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      <div
        className={`${styles.mobileOverlay} ${mobileOpen ? styles.open : ""}`}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Mobile menu */}
      <div
        className={`${styles.mobileMenu} ${mobileOpen ? styles.open : ""}`}
        role="dialog"
        aria-label="Mobile navigation"
      >
        <ul role="list">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={styles.mobileLink}
                onClick={closeMobile}
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href={PRODUCT.github}
              className={styles.mobileLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMobile}
            >
              <Github size={18} />
              GitHub
            </a>
          </li>
          <li className={styles.mobileCta}>
            <a
              href="#download"
              className="btn btn-primary btn-lg"
              onClick={closeMobile}
              style={{ width: "100%" }}
            >
              <Download size={16} />
              Download PostCompass
            </a>
          </li>
        </ul>
      </div>
    </header>
  );
}
