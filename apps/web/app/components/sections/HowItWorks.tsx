"use client";

import { useEffect, useRef, useState } from "react";
import { WindowsIcon, AppleIcon, LinuxIcon, Check } from "@/components/ui/Icons";
import SectionHeader from "@/components/ui/SectionHeader";

const STEPS = [
  { title: "Download the app", text: "Windows, macOS or Linux. No account needed." },
  { title: "Create or connect", text: "A local PostgreSQL in a minute, or your cloud database." },
  { title: "Explore your data", text: "Filter, edit and query. Press Ctrl K to jump anywhere." },
];

/* Everything plays once when the section scrolls into view (data-shown on the list),
   one card after another (--s is the card's delay, --d an item's delay within its card).
   Reduced motion shows every card in its finished state. */
const SHOW_IN =
  "group-data-shown:opacity-100 group-data-shown:[transform:none] motion-reduce:opacity-100 motion-reduce:[transform:none] motion-reduce:transition-none";
const INSTALL_STATE = "col-start-1 row-start-1 text-right [transition:opacity_0.3s_ease_calc(var(--s)+1.6s)]";

/* ---- The small visual at the top of each card ---- */

function DownloadVisual() {
  const files = [
    { Icon: WindowsIcon, name: "setup.exe" },
    { Icon: AppleIcon, name: ".dmg" },
    { Icon: LinuxIcon, name: ".AppImage" },
  ];
  return (
    <div className="flex gap-[0.6rem]">
      {files.map(({ Icon, name }, i) => (
        <div
          key={name}
          className={`flex min-w-[4.6rem] flex-col items-center gap-[0.45rem] rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[rgba(10,12,11,0.8)] px-[0.6rem] pt-[0.8rem] pb-[0.7rem] text-fg opacity-0 [transform:translateY(8px)] [transition:opacity_0.4s_ease_calc(var(--s)+0.3s+var(--d)),transform_0.4s_ease_calc(var(--s)+0.3s+var(--d)),border-color_0.2s_ease] group-hover/step:border-[rgba(16,185,129,0.3)] ${SHOW_IN}`}
          style={{ ["--d" as string]: `${i * 0.12}s` }}
        >
          <Icon size={18} />
          <span className="font-mono text-[0.68rem] text-fg-muted">{name}</span>
        </div>
      ))}
    </div>
  );
}

function InstallVisual() {
  return (
    <div className="w-full max-w-[15rem] font-mono text-[0.75rem] text-fg-secondary">
      <div className="mb-2 flex justify-between">
        <span>PostgreSQL 18</span>
        <span className="grid">
          <span className={`${INSTALL_STATE} text-fg-muted group-data-shown:opacity-0 motion-reduce:opacity-0`}>Installing…</span>
          <span
            className={`${INSTALL_STATE} text-accent-hover opacity-0 group-data-shown:opacity-100 motion-reduce:opacity-100 motion-reduce:transition-none`}
          >
            Ready
          </span>
        </span>
      </div>
      <div className="h-[6px] overflow-hidden rounded-[3px] bg-[rgba(255,255,255,0.07)]">
        <span className="block h-full origin-left rounded-[inherit] bg-[linear-gradient(90deg,#059669,#34d399)] [transform:scaleX(0)] [transition:transform_1.3s_cubic-bezier(0.4,0,0.2,1)_calc(var(--s)+0.3s)] group-data-shown:[transform:scaleX(1)] motion-reduce:opacity-100 motion-reduce:[transform:none] motion-reduce:transition-none" />
      </div>
      <div className={`mt-[0.85rem] flex items-center gap-[0.45rem] text-fg opacity-0 [transition:opacity_0.4s_ease_calc(var(--s)+1.7s)] ${SHOW_IN}`}>
        <span className="size-[7px] rounded-full bg-accent-hover shadow-[0_0_0_3px_rgba(52,211,153,0.2)]" />
        <span>running</span>
        <span className="ml-auto text-fg-muted">127.0.0.1:5432</span>
      </div>
    </div>
  );
}

function TableVisual() {
  const rows = [
    ["1042", "Ava Chen", "$129"],
    ["1043", "Liam Ortiz", "$48"],
    ["1044", "Noah Patel", "$310"],
  ];
  return (
    <div className="w-full max-w-[15rem] font-mono text-[0.72rem]">
      <span className="mb-[0.55rem] inline-block rounded-full border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.1)] px-2 py-[0.15rem] text-[#6ee7b7]">
        status <b className="font-normal text-fg-muted">=</b> paid
      </span>
      <div className="overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.07)]">
        {rows.map((r, i) => (
          <div
            key={r[0]}
            className={`grid grid-cols-[2.6rem_1fr_auto] gap-2 px-[0.6rem] py-[0.35rem] opacity-0 [transform:translateX(-6px)] [transition:opacity_0.35s_ease_calc(var(--s)+0.4s+var(--d)),transform_0.35s_ease_calc(var(--s)+0.4s+var(--d)),background_0.2s_ease] not-first:border-t not-first:border-[rgba(255,255,255,0.05)] [&_span:first-child]:text-fg-faint ${SHOW_IN} ${
              i === 1 ? "bg-[rgba(16,185,129,0.08)] text-fg shadow-[inset_2px_0_0_#34d399]" : "text-fg-secondary"
            }`}
            style={{ ["--d" as string]: `${i * 0.1}s` }}
          >
            {r.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const VISUALS = [DownloadVisual, InstallVisual, TableVisual];

export default function HowItWorks() {
  // The cards animate once, the first time the section scrolls into view
  const listRef = useRef<HTMLOListElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="relative py-24 max-lg:py-16 max-md:py-12" id="how-it-works">
      <div className="mx-auto w-full max-w-[1200px] px-6 max-md:px-4">
        <SectionHeader
          badge="How it works"
          title="From download to your first query in minutes"
          description="No Docker, no config files, nothing to babysit."
        />

        <ol ref={listRef} data-shown={shown || undefined} className="group relative grid grid-cols-3 gap-5 max-[861px]:grid-cols-1">
          {/* An <ol> may only hold <li>s, so the connecting line is a presentational one */}
          <li
            className="absolute top-[4.5rem] right-[8%] left-[8%] h-px overflow-hidden bg-[rgba(255,255,255,0.06)] max-[861px]:hidden"
            role="presentation"
            aria-hidden="true"
          >
            <span className="absolute inset-0 origin-left bg-[linear-gradient(90deg,transparent,#10b981_20%,#34d399_80%,transparent)] [transform:scaleX(0)] [transition:transform_1.4s_cubic-bezier(0.65,0,0.35,1)_0.2s] group-data-shown:[transform:scaleX(1)] motion-reduce:opacity-100 motion-reduce:[transform:none] motion-reduce:transition-none" />
          </li>
          {STEPS.map((s, i) => {
            const Visual = VISUALS[i]!;
            return (
              <li
                key={s.title}
                className={`group/step relative flex flex-col overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-root bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))] opacity-0 [transform:translateY(14px)] [transition:opacity_0.6s_ease_var(--s),transform_0.6s_ease_var(--s),border-color_0.2s_ease] hover:border-[rgba(16,185,129,0.3)] ${SHOW_IN}`}
                style={{ ["--s" as string]: `${i * 0.35}s` }}
              >
                <div
                  className="flex h-36 items-center justify-center border-b border-[rgba(255,255,255,0.06)] bg-[radial-gradient(ellipse_80%_90%_at_50%_0%,rgba(16,185,129,0.1),transparent_70%)] px-5 py-4"
                  aria-hidden="true"
                >
                  <Visual />
                </div>
                <div className="px-6 pt-5 pb-6">
                  <span className="inline-flex items-center gap-[0.35rem] font-mono text-[0.75rem] text-fg-faint">
                    <Check
                      size={12}
                      className={`text-accent-hover opacity-0 [transform:scale(0.5)] [transition:opacity_0.3s_ease_calc(var(--s)+1.2s),transform_0.3s_ease_calc(var(--s)+1.2s)] ${SHOW_IN}`}
                    />
                    0{i + 1}
                  </span>
                  <h3 className="mt-2 mb-[0.4rem] text-[1.15rem] font-[650] tracking-[-0.015em] text-fg">{s.title}</h3>
                  <p className="text-[0.925rem] leading-[1.6] text-fg-secondary">{s.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
