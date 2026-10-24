"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_VIDEO_EMBED_URL } from "../config/product";
import { X } from "./Icons";
import styles from "./DemoVideo.module.css";

// Hosts the Drive player loads from; connecting to them early saves the handshakes on click
const PLAYER_ORIGINS = ["https://drive.google.com", "https://www.gstatic.com", "https://drive.usercontent.google.com"];
const PHONE = "(max-width: 640px) and (pointer: coarse)";

// Screen orientation locking isn't in every browser's typings yet
type LockableOrientation = ScreenOrientation & { lock?: (o: "landscape") => Promise<void> };

export default function DemoVideo() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
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
  const reset = () => {
    setOpen(false);
    setWarm(false);
    setLoaded(false);
  };
  // Opening adds a history entry, so closing goes back through it; the popstate handler below then resets
  const close = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    if ((history.state as { demoVideo?: boolean } | null)?.demoVideo) history.back();
    else reset();
  };

  // On phones the player goes straight to real full screen (and landscape where allowed). Browsers that can't
  // do this for an embedded player, like Safari on iPhone, still get the full-screen modal from the CSS.
  const openPlayer = () => {
    warmUp();
    setOpen(true);
    // The phone's Back button or gesture then closes the video instead of leaving the page.
    // Next's own state is kept in the entry so its router treats going back as staying on this page.
    history.pushState({ ...(history.state as object | null), demoVideo: true }, "");
    const dialog = dialogRef.current;
    const player = playerRef.current;
    if (!dialog || !player || !window.matchMedia(PHONE).matches || !player.requestFullscreen) return;
    if (!dialog.open) dialog.showModal(); // must be showing, inside this tap, before it can go full screen
    player
      .requestFullscreen()
      .then(() => (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape"))
      .catch(() => {});
  };

  // Back closes the player, and leaving full screen on a phone closes it too, so there's no second step
  useEffect(() => {
    if (!open) return;
    const onPop = () => {
      if (!(history.state as { demoVideo?: boolean } | null)?.demoVideo) reset();
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement && window.matchMedia(PHONE).matches) close();
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
    // close and reset only call state setters and the history/fullscreen APIs, so they never go stale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
        onClick={openPlayer}
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
        </div>
        <div className={styles.player} ref={playerRef}>
          {!loaded && <span className={styles.spinner} role="status" aria-label="Loading video" />}
          {warm && (
            <iframe
              src={DEMO_VIDEO_EMBED_URL}
              title="PostCompass demo video"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              onLoad={() => setLoaded(true)}
              className={loaded ? "" : styles.playerLoading}
            />
          )}
          {/* Our close button sits exactly over Drive's pop-out button, hiding it, so the video stays on the site.
              It's inside the player, so it's still there in full screen. */}
          {warm && (
            <button type="button" className={styles.playerClose} aria-label="Close video" onClick={close}>
              <X size={18} />
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
