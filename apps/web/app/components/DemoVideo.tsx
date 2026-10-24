"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { DEMO_VIDEO_URL } from "../config/product";
import { X } from "./Icons";
import styles from "./DemoVideo.module.css";

// A phone held either way: narrow in portrait, short in landscape (same rule as the CSS)
const PHONE = "(pointer: coarse) and (max-width: 640px), (pointer: coarse) and (max-height: 500px)";
const HIDE_CONTROLS_MS = 2500;

// iPhone Safari can't put an element in full screen, only a <video> through its own API
type IOSVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };
// Screen orientation locking isn't in every browser's typings yet
type LockableOrientation = ScreenOrientation & { lock?: (o: "landscape") => Promise<void>; unlock?: () => void };

const formatTime = (s: number) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/* ---- Small control icons ---- */
const PlayIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" fill="currentColor" />
  </svg>
);
const PauseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
  </svg>
);
const VolumeIcon = ({ muted }: { muted: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
    {muted ? (
      <>
        <line x1="22" y1="9" x2="16" y2="15" />
        <line x1="16" y1="9" x2="22" y2="15" />
      </>
    ) : (
      <>
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </>
    )}
  </svg>
);
const FullscreenIcon = ({ on }: { on: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {on ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
  </svg>
);

export default function DemoVideo() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  const [open, setOpen] = useState(false);
  // Hover, focus or press starts buffering, so playback starts quickly on click
  const [warm, setWarm] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsShown, setControlsShown] = useState(true);

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

  /* ---- Controls auto-hide while playing ---- */
  const showControls = () => {
    setControlsShown(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsShown(false);
    }, HIDE_CONTROLS_MS);
  };

  /* ---- Opening and closing ---- */
  const warmUp = () => setWarm(true);
  const reset = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    window.clearTimeout(hideTimer.current);
    setOpen(false);
    setControlsShown(true);
  };
  // Opening adds a history entry, so closing goes back through it; the popstate handler below then resets
  const close = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    if ((history.state as { demoVideo?: boolean } | null)?.demoVideo) history.back();
    else reset();
  };

  // With landscape, a phone also turns sideways once full screen (where the browser allows it, e.g. Android;
  // iPhone's own full-screen player rotates with the phone)
  const enterFullscreen = (landscape = false) => {
    const player = playerRef.current;
    const video = videoRef.current as IOSVideo | null;
    if (player?.requestFullscreen) {
      player
        .requestFullscreen()
        .then(() => {
          if (landscape && window.matchMedia(PHONE).matches) {
            return (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape");
          }
        })
        .catch(() => {});
    } else video?.webkitEnterFullscreen?.();
  };

  const openPlayer = () => {
    warmUp();
    setOpen(true);
    // The phone's Back button or gesture then closes the video instead of leaving the page.
    // Next's own state is kept in the entry so its router treats going back as staying on this page.
    history.pushState({ ...(history.state as object | null), demoVideo: true }, "");
    const dialog = dialogRef.current;
    const video = videoRef.current;
    if (!dialog || !video) return;
    if (!dialog.open) dialog.showModal(); // showing, inside this tap, so play and full screen are allowed
    void video.play().catch(() => {});
    showControls();
  };

  // Back closes the player; leaving full screen just returns to the modal
  useEffect(() => {
    if (!open) return;
    const onPop = () => {
      if (!(history.state as { demoVideo?: boolean } | null)?.demoVideo) reset();
    };
    const onFullscreen = () => {
      setFullscreen(Boolean(document.fullscreenElement));
      // Give the phone its normal rotation back when leaving full screen
      if (!document.fullscreenElement) (screen.orientation as LockableOrientation | undefined)?.unlock?.();
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
    // close and reset only use refs, state setters and browser APIs, so they never go stale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ---- Playback ---- */
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
    showControls();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    showControls();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else enterFullscreen(true);
    showControls();
  };

  const seek = (to: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = Math.min(duration, Math.max(0, to));
    setTime(video.currentTime);
    showControls();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLInputElement) return; // the timeline handles its own arrow keys
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowRight") seek(time + 5);
    else if (e.key === "ArrowLeft") seek(time - 5);
    else if (e.key === "m") toggleMute();
    else if (e.key === "f") toggleFullscreen();
  };

  const progress = duration ? (time / duration) * 100 : 0;

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
          <PlayIcon size={15} />
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
        <div
          ref={playerRef}
          className={`${styles.player} ${controlsShown || !playing ? styles.controlsOn : ""}`}
          onPointerMove={showControls}
          onKeyDown={onKeyDown}
        >
          <video
            ref={videoRef}
            className={styles.video}
            src={DEMO_VIDEO_URL}
            // Nothing downloads until the visitor shows intent, then it buffers ahead
            preload={warm ? "auto" : "none"}
            playsInline
            disablePictureInPicture
            controlsList="nodownload noplaybackrate noremoteplayback"
            onClick={togglePlay}
            onPlay={() => setPlaying(true)}
            onPause={() => {
              setPlaying(false);
              setControlsShown(true);
            }}
            onEnded={() => setControlsShown(true)}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => setBuffering(false)}
            onCanPlay={() => setBuffering(false)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onProgress={(e) => {
              const v = e.currentTarget;
              if (v.buffered.length && v.duration) setBuffered((v.buffered.end(v.buffered.length - 1) / v.duration) * 100);
            }}
          />

          {buffering && <span className={styles.spinner} role="status" aria-label="Loading video" />}

          {!playing && !buffering && (
            <button type="button" className={styles.bigPlay} aria-label="Play" onClick={togglePlay}>
              <PlayIcon size={26} />
            </button>
          )}

          <button type="button" className={styles.playerClose} aria-label="Close video" onClick={close}>
            <X size={18} />
          </button>

          {/* One control bar along the bottom */}
          <div className={styles.controls}>
            <button type="button" className={styles.ctrl} aria-label={playing ? "Pause" : "Play"} onClick={togglePlay}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <span className={styles.time}>
              {formatTime(time)} <span className={styles.timeTotal}>/ {formatTime(duration)}</span>
            </span>
            <input
              type="range"
              className={styles.timeline}
              min={0}
              max={duration || 0}
              step={0.1}
              value={time}
              aria-label="Seek"
              aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
              style={{ ["--progress" as string]: `${progress}%`, ["--buffered" as string]: `${buffered}%` }}
              onChange={(e) => seek(Number(e.target.value))}
            />
            <button type="button" className={styles.ctrl} aria-label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
              <VolumeIcon muted={muted} />
            </button>
            <button
              type="button"
              className={styles.ctrl}
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
              onClick={toggleFullscreen}
            >
              <FullscreenIcon on={fullscreen} />
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
