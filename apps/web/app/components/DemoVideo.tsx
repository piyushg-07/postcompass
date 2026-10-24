"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_VIDEO_EMBED_URL } from "../config/product";
import { X } from "./Icons";
import styles from "./DemoVideo.module.css";

// Hosts the Drive player loads from; connecting to them early saves the handshakes on click
const PLAYER_ORIGINS = ["https://drive.google.com", "https://www.gstatic.com", "https://drive.usercontent.google.com"];

export default function DemoVideo() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  // The player mounts as soon as the visitor shows intent (hover, focus or press) so it is
  // already loading by the time they click, and unmounts on close to stop playback.
  const [warm, setWarm] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    for (const href of PLAYER_ORIGINS) {
      if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = href;
      link.crossOrigin = "";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    // Keep the page behind the modal from scrolling
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  const warmUp = () => setWarm(true);
  const close = () => {
    setOpen(false);
    setWarm(false);
    setLoaded(false);
  };

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Watch the demo"
        aria-haspopup="dialog"
        onPointerEnter={warmUp}
        onPointerDown={warmUp}
        onFocus={warmUp}
        onClick={() => {
          warmUp();
          setOpen(true);
        }}
      >
        {/* A slowly spinning gradient ring around a dark core with the play icon */}
        <span className={styles.ring} aria-hidden="true" />
        <span className={styles.core} aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24">
            <path
              d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span className={styles.tooltip} aria-hidden="true">See PostCompass in action</span>
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-label="PostCompass demo video"
        onClose={close}
        // A click on the dialog itself (not its content) is a click on the backdrop
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className={styles.dialogHead}>
          <span>PostCompass demo</span>
          <button type="button" className={styles.close} aria-label="Close" onClick={close}>
            <X size={16} />
          </button>
        </div>
        <div className={styles.player}>
          {!loaded && <span className={styles.spinner} role="status" aria-label="Loading video" />}
          {warm && (
            <iframe
              src={DEMO_VIDEO_EMBED_URL}
              title="PostCompass demo video"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              onLoad={() => setLoaded(true)}
              className={loaded ? "" : styles.playerLoading}
            />
          )}
        </div>
      </dialog>
    </>
  );
}
