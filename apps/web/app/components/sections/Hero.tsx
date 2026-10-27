"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { datadogRum } from "@datadog/browser-rum";
import dynamic from "next/dynamic";
import type HyperspeedComponent from "@/components/hero/Hyperspeed";
import { WindowsIcon, AppleIcon, LinuxIcon } from "@/components/ui/Icons";
import AppPreview from "@/components/hero/AppPreview";
import DemoVideo from "@/components/hero/DemoVideo";
import { ACCENT } from "@/config/theme";

// three.js is large: load it separately so it doesn't hold up the page or the headline animation
const Hyperspeed = dynamic<ComponentProps<typeof HyperspeedComponent>>(
  () => import("@/components/hero/Hyperspeed"),
  { ssr: false }
);

type Os = "windows" | "macos" | "linux";

const OS_LABEL: Record<Os, string> = { windows: "Windows", macos: "macOS", linux: "Linux" };
const OS_ICON = { windows: WindowsIcon, macos: AppleIcon, linux: LinuxIcon };

// The headline is "returned" by a query; the hero cycles through a few, each with its own row
const QUERIES = [
  { column: "tagline", table: "postcompass", lead: ["Your", "PostgreSQL,"], accent: "charted.", ms: "0.4" },
  { column: "setup", table: "local_db", lead: ["One", "click."], accent: "Zero setup.", ms: "0.3" },
  { column: "clouds", table: "connections", lead: ["Every", "cloud,"], accent: "one place.", ms: "1.2" },
  { column: "size", table: "installer", lead: ["3 MB.", "Fully"], accent: "native.", ms: "0.2" },
];
const QUERY_INTERVAL_MS = 4800;

// Each headline word rises in, staggered by its index (--i) after the row delay
const WORD =
  "inline-block will-change-[transform,opacity] animate-[hero-word-in_0.8s_cubic-bezier(0.16,1,0.3,1)_calc(var(--row-delay,1.1s)_+_var(--i)_*_0.11s)_both] motion-reduce:animate-none";

export default function Hero({ version }: { version: string }) {
  const [os, setOs] = useState<Os>("windows");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) setOs("macos");
    else if (ua.includes("linux") && !ua.includes("android")) setOs("linux");
  }, []);

  const OsIcon = OS_ICON[os];

  // Start the light trails once the headline has animated in (or the browser is idle), then fade them in
  const [backdropReady, setBackdropReady] = useState(false);
  useEffect(() => {
    const start = () => setBackdropReady(true);
    const timer = window.setTimeout(() => {
      if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 600 });
      else start();
    }, 1300);
    return () => window.clearTimeout(timer);
  }, []);

  const [queryIndex, setQueryIndex] = useState(0);
  const [hasCycled, setHasCycled] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setHasCycled(true);
      setQueryIndex((i) => (i + 1) % QUERIES.length);
    }, QUERY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, queryIndex]);

  const query = QUERIES[queryIndex] ?? QUERIES[0]!;
  const queryLength = `SELECT ${query.column} FROM ${query.table};`.length;
  // The first run waits for the page to settle; later runs start right away
  const timing = hasCycled
    ? { ["--type-delay" as string]: "0s", ["--row-delay" as string]: "0.65s" }
    : { ["--type-delay" as string]: "0.4s", ["--row-delay" as string]: "1.1s" };

  // The preview lies back in 3D and stands up as it scrolls into view
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = previewRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the top of the preview sits near the bottom of the screen, 1 once it's well in view
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.75)));
      el.style.setProperty("--lift", p >= 0.995 ? "1" : p.toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section className="relative overflow-x-clip overflow-y-visible pt-[6.5rem] pb-[5.5rem]" id="hero">
      <div className="pointer-events-auto absolute top-[-70px] right-0 left-0 z-[1] h-[720px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0,black_90px,black_62%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,black_90px,black_62%,transparent_100%)] max-[900px]:top-[-50px] max-[900px]:h-[780px] max-[600px]:top-[-40px] max-[600px]:h-[850px] [&>*]:animate-[hero-backdrop-in_1.4s_ease_both]">
        {backdropReady && <Hyperspeed
          curve="winding"
          curvature={0.8}
          speed={1.2}
          boost={3.5}
          fov={85}
          boostFov={125}
          lanes={3}
          roadWidth={10}
          medianWidth={2}
          density={45}
          trailLength={1.3}
          lightSize={1.3}
          poles={18}
          dust={140}
          glow={0.7}
          reflections={0.5}
          roadOpacity={0.18}
          steer={0.3}
          cameraYOffset={-1.5}
          lookAtYOffset={1.8}
          tailColors={[ACCENT.base, ACCENT.strong, ACCENT.light]}
          headColors={["#06b6d4", "#0284c7", "#38bdf8"]}
          poleColors={[ACCENT.base]}
          interactive
        />}
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1] [background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_60%_420px_at_50%_280px,black_30%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_60%_420px_at_50%_280px,black_30%,transparent_100%)]" />

      <div className="pointer-events-none relative z-[5] mx-auto flex w-full max-w-[1200px] flex-col items-center px-6 pt-[5.25rem] text-center before:pointer-events-none before:absolute before:top-[6.5rem] before:left-1/2 before:z-[-1] before:h-[30rem] before:w-[min(900px,100%)] before:-translate-x-1/2 before:bg-[radial-gradient(ellipse_at_50%_45%,rgba(5,6,6,0.62)_0%,rgba(5,6,6,0.38)_42%,transparent_72%)] before:content-[''] max-md:px-4 max-[640px]:pt-[3.25rem] [&>*]:pointer-events-auto">
        {/* The page opens by "running" a query; the headline is its result */}
        <h1 className="sr-only">
          PostCompass — Fast, Modern Open-Source Desktop GUI &amp; Database Client for PostgreSQL
        </h1>
        <div
          className="flex w-[min(1000px,100%)] flex-col items-center"
          style={timing}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <p
            className="m-0 inline-flex items-center gap-[0.6rem] font-mono text-[0.875rem] text-[#a1a1aa] [text-shadow:0_1px_10px_rgba(0,0,0,0.95)] max-[640px]:text-[0.75rem]"
            aria-hidden="true"
          >
            <span className="font-semibold text-accent-light">=#</span>
            <span
              key={queryIndex}
              className="inline-block w-[calc(var(--len)*1ch)] animate-[hero-type-query_0.6s_steps(var(--len),end)_var(--type-delay,0.4s)_both] overflow-hidden whitespace-nowrap motion-reduce:animate-none"
              style={{ ["--len" as string]: queryLength }}
            >
              <span className="text-[#c792ea]">SELECT</span> {query.column} <span className="text-[#c792ea]">FROM</span> {query.table};
            </span>
            <span className="-ml-[0.45rem] h-[15px] w-[7px] animate-[caret-blink_1s_steps(1)_infinite] rounded-[1px] bg-accent-light motion-reduce:animate-none" />
          </p>
          <div className="mt-[1.1rem] grid w-full [&>*]:[grid-area:1/1]" aria-hidden="true">
            {QUERIES.map((q, i) => (
              <p
                key={i === queryIndex ? `on-${queryIndex}` : i}
                className={`m-0 font-sans text-[length:clamp(2.6rem,6.4vw,5rem)] leading-[1.04] font-bold tracking-[-0.045em] text-balance text-fg ${i === queryIndex ? "" : "invisible"}`}
              >
                {q.lead.map((word, w) => (
                  <span key={w}>
                    <span className={WORD} style={{ ["--i" as string]: w }}>{word}</span>{" "}
                  </span>
                ))}
                <em
                  className={`${WORD} bg-[linear-gradient(100deg,var(--color-accent-light)_0%,var(--color-accent)_45%,var(--color-accent-pale)_100%)] bg-clip-text pr-[0.06em] font-display font-medium tracking-[-0.02em] text-transparent italic [-webkit-background-clip:text]`}
                  style={{ ["--i" as string]: q.lead.length }}
                >
                  {q.accent}
                </em>
              </p>
            ))}
          </div>
          <div className="mt-[0.6rem] flex items-center gap-[0.9rem] font-mono text-[0.75rem] text-[#52525b]">
            <span
              key={queryIndex}
              className="animate-[hero-fade-up_0.4s_ease_var(--row-delay,1.1s)_both] motion-reduce:animate-none"
              aria-hidden="true"
            >
              (1 row) · {query.ms} ms
            </span>
          </div>
        </div>

        <p className="mt-[1.4rem] max-w-[760px] animate-[hero-fade-up_0.6s_ease_1.3s_both] text-[length:clamp(0.95rem,1.4vw,1.05rem)] leading-[1.7] text-pretty text-[#8a8a93] [text-shadow:0_1px_14px_rgba(0,0,0,0.9)] motion-reduce:animate-none">
          Run PostgreSQL locally in one click, connect to any cloud, and browse, edit and
          query your data in one fast, native app.
        </p>

        <div className="mt-[2.25rem] flex animate-[hero-fade-up_0.6s_ease_1.45s_both] flex-wrap justify-center gap-3 motion-reduce:animate-none max-[640px]:flex-nowrap">
          <a
            href="#download"
            onClick={() => datadogRum.addAction("download_cta_clicked", { location: "hero", os })}
            className="inline-flex h-[2.9rem] items-center gap-[0.55rem] rounded-[10px] bg-accent px-[1.4rem] text-[0.9375rem] font-semibold text-accent-fg no-underline shadow-[inset_0_0_0_1px_rgb(var(--accent-light-rgb)/0.5),0_8px_28px_rgb(var(--accent-rgb)/0.28)] [transition:transform_0.15s_ease,background_0.2s_ease,border-color_0.2s_ease,box-shadow_0.2s_ease] hover:bg-accent-hover hover:shadow-[inset_0_0_0_1px_rgb(var(--accent-pale-rgb)/0.6),0_12px_34px_rgb(var(--accent-rgb)/0.38)] hover:[transform:translateY(-1px)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent-hover"
            aria-label={`Download for ${OS_LABEL[os]}`}
            suppressHydrationWarning
          >
            <OsIcon size={15} />
            <span>Download</span>
          </a>
          <DemoVideo />
        </div>

        <p className="mt-[1.25rem] flex animate-[hero-fade-up_0.6s_ease_1.6s_both] flex-wrap items-center justify-center gap-[0.55rem_0.75rem] text-[0.8125rem] text-[#9a9aa3] [text-shadow:0_1px_10px_rgba(0,0,0,0.95)] motion-reduce:animate-none">
          <span>Free and open source · v{version}</span>
          <span className="h-[3px] w-[3px] rounded-full bg-fg-faint" aria-hidden="true" />
          <span>Windows, macOS and Linux</span>
        </p>

        <div
          className="relative mt-[6.75rem] w-full max-w-[1120px] animate-[hero-fade-up_0.9s_ease_1.7s_both] [perspective:1800px] motion-reduce:animate-none max-[640px]:mt-[4.25rem]"
          ref={previewRef}
        >
          <div
            className="pointer-events-none absolute [inset:-6%_8%_auto] h-[70%] bg-[radial-gradient(ellipse_at_50%_30%,rgb(var(--accent-rgb)/0.2),transparent_70%)] blur-[70px]"
            aria-hidden="true"
          />
          <div className="relative origin-top rounded-[16px] bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03))] p-[6px] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.04)] will-change-transform [transform:rotateX(calc((1_-_var(--lift,1))_*_24deg))_scale(calc(0.9_+_var(--lift,1)_*_0.1))] motion-reduce:[transform:none] max-[640px]:rounded-[12px] max-[640px]:p-[4px]">
            <AppPreview />
          </div>
          <p className="mt-[1.1rem] flex flex-wrap items-center justify-center gap-[0.4rem_0.6rem] text-[0.8125rem] text-fg-muted [&_code]:font-mono [&_code]:text-fg-secondary [&_kbd]:inline-block [&_kbd]:rounded-[4px] [&_kbd]:border [&_kbd]:border-solid [&_kbd]:border-line-hover [&_kbd]:px-[0.35rem] [&_kbd]:py-0 [&_kbd]:font-mono [&_kbd]:text-[0.72rem] [&_kbd]:text-fg-secondary">
            <span className="h-[7px] w-[7px] rounded-full bg-success shadow-[0_0_0_3px_rgb(var(--success-rgb)/0.2)]" aria-hidden="true" />
            <span>Interactive preview with sample data.</span>
            <span className="text-fg-faint max-[640px]:hidden">
              Try: open a table, filter by <code>status</code>, double-click a cell, run a query, or press <kbd>Ctrl</kbd> <kbd>K</kbd>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
