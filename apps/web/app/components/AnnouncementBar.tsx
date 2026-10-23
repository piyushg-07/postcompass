"use client";

import { useState } from "react";
import { X, Sparkles } from "./Icons";
import styles from "./AnnouncementBar.module.css";

interface AnnouncementBarProps {
  message?: string;
  href?: string;
}

export default function AnnouncementBar({
  message = "PostCompass is now available for Windows, macOS, and Linux",
  href = "#download",
}: AnnouncementBarProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className={styles.bar} role="banner">
      <a href={href} className={styles.content}>
        <Sparkles size={14} className={styles.icon} />
        <span>{message}</span>
        <span className={styles.arrow}>→</span>
      </a>
      <button
        className={styles.close}
        onClick={(e) => {
          e.preventDefault();
          setVisible(false);
        }}
        aria-label="Dismiss announcement"
      >
        <X size={14} />
      </button>
    </div>
  );
}
