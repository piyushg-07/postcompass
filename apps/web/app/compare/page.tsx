import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeader from "@/components/ui/SectionHeader";
import CompareTable from "@/components/compare/CompareTable";
import { AppleIcon, Check, Download, Github, LinuxIcon, Lock, WindowsIcon, X } from "@/components/ui/Icons";
import { PRODUCT, getDownloads } from "@/config/product";
import { COMPARED_ON, SOURCES } from "@/config/compare";
import { getLatestRelease } from "@/lib/release";

export const metadata: Metadata = {
  title: "Why PostCompass: compared with pgAdmin, DBeaver, DataGrip, TablePlus and more",
  description:
    "How PostCompass compares with pgAdmin, DBeaver, DataGrip, TablePlus, Beekeeper Studio and Postico: price, size, open source, and running PostgreSQL locally without Docker.",
  alternates: { canonical: "/compare" },
  openGraph: {
    title: "Why PostCompass: the free, lightweight PostgreSQL GUI",
    description:
      "Compared with pgAdmin, DBeaver, DataGrip, TablePlus, Beekeeper Studio and Postico. Free, open source, and it runs PostgreSQL for you.",
    url: `${PRODUCT.website}/compare`,
    type: "website",
    images: ["/opengraph-image"],
  },
};

const CARD =
  "relative flex flex-col overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-root bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))] [transition:border-color_0.2s_ease] hover:border-[rgb(var(--accent-rgb)/0.3)]";
const VISUAL =
  "flex h-48 items-center justify-center border-b border-[rgba(255,255,255,0.06)] bg-[radial-gradient(ellipse_80%_90%_at_50%_0%,rgb(var(--accent-rgb)/0.08),transparent_70%)] px-6";
const SECTION = "relative py-24 max-lg:py-16 max-md:py-12";
const CONTAINER = "mx-auto w-full max-w-[1200px] px-6 max-md:px-4";

/* ---- The problem: three things other tools charge you ---- */

function SetupVisual() {
  const steps = ["Download the PostgreSQL installer", "Run it as administrator", "Set up a service and PATH", "…or learn Docker first"];
  return (
    <div className="w-full max-w-[16rem] font-mono text-[0.74rem]" aria-hidden="true">
      <ul className="flex flex-col gap-[0.4rem]">
        {steps.map((s) => (
          <li key={s} className="flex items-center gap-2 text-fg-faint line-through decoration-[rgba(255,255,255,0.25)]">
            <X size={11} className="shrink-0 text-fg-faint" />
            {s}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2 rounded-[8px] border border-[rgb(var(--accent-rgb)/0.3)] bg-[rgb(var(--accent-rgb)/0.08)] px-[0.6rem] py-[0.4rem] text-accent-pale">
        <span className="size-[7px] rounded-full bg-success shadow-[0_0_0_3px_rgb(var(--success-rgb)/0.2)]" />
        PostgreSQL 18 · running
      </div>
    </div>
  );
}

function WeightVisual({ size }: { size: string }) {
  // Illustrative, not measured: the others carry a whole runtime, PostCompass does not
  const stacks = ["Java + bundled JDK", "Python + Electron", "Electron + Chromium"];
  return (
    <div className="w-full max-w-[16rem] font-mono text-[0.72rem]" aria-hidden="true">
      {stacks.map((s) => (
        <div key={s} className="mb-[0.45rem]">
          <div className="mb-1 flex justify-between text-fg-faint">
            <span>{s}</span>
            <span>+ runtime</span>
          </div>
          <div className="h-[6px] rounded-full bg-[rgba(255,255,255,0.1)]" />
        </div>
      ))}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-accent-pale">
          <span>Rust + system webview</span>
          <span>{size}</span>
        </div>
        <div className="h-[6px] w-[12%] rounded-full bg-accent-light shadow-[0_0_10px_rgb(var(--accent-light-rgb)/0.6)]" />
      </div>
    </div>
  );
}

function PaywallVisual() {
  const locked = ["ER diagram", "Visual query plan", "Import and export"];
  return (
    <div className="flex w-full max-w-[16rem] flex-col gap-[0.45rem] text-[0.8rem]" aria-hidden="true">
      {locked.map((f) => (
        <div
          key={f}
          className="flex items-center justify-between rounded-[8px] border border-[rgba(255,255,255,0.07)] bg-[rgba(10,12,11,0.8)] px-3 py-[0.45rem] text-fg-muted"
        >
          {f}
          <span className="inline-flex items-center gap-1 font-mono text-[0.66rem] text-key-primary">
            <Lock size={11} /> paid plan
          </span>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-center gap-1.5 font-mono text-[0.72rem] text-accent-pale">
        <Check size={12} /> All included in PostCompass
      </div>
    </div>
  );
}


export default async function ComparePage() {
  const downloads = getDownloads(await getLatestRelease());
  const windowsSize = downloads.platforms.find((p) => p.platform === "windows")?.assets[0]?.size ?? "3 MB";


  const PROBLEMS = [
    {
      visual: <SetupVisual />,
      tag: "The setup tax",
      title: "A database before you can use your database tool",
      text: "Every other client assumes PostgreSQL is already running. Getting there means installers, admin rights, services, or Docker.",
      answer: "PostCompass downloads, verifies and runs PostgreSQL 14 to 18 for you.",
    },
    {
      visual: <WeightVisual size={windowsSize} />,
      tag: "The weight",
      title: "A whole runtime for a table viewer",
      text: "Most clients ship a Java VM, a copy of Chromium, or both. That's a big download, slower starts and memory you'd rather give your database.",
      answer: "PostCompass is built in Rust and uses the webview already in your OS.",
    },
    {
      visual: <PaywallVisual />,
      tag: "The paywall",
      title: "The useful parts cost extra",
      text: "Free editions often stop short: diagrams, query-plan graphs or import and export move to a paid plan, per seat, per year.",
      answer: "PostCompass has one edition. Everything is in it, free.",
    },
  ];

  return (
    <>
      <Navbar />
      <main id="main-content">
        {/* Hero */}
        <section className="relative overflow-hidden pt-64 pb-32 max-md:pt-36 max-md:pb-16">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgb(var(--accent-rgb)/0.14),transparent_70%)]"
            aria-hidden="true"
          />
          <div className={`${CONTAINER} relative text-center`}>
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-line-accent bg-accent-muted px-3 py-1 text-xs font-semibold tracking-[0.05em] text-accent uppercase">
              Why PostCompass
            </span>
            <h1 className="mx-auto font-display text-[3rem] leading-[1.1] font-bold tracking-[-0.03em] text-fg max-lg:text-5xl max-md:text-4xl max-[480px]:text-[2rem]">
              Every Postgres tool costs you something.
              {/* The answer always starts its own line, so "Setup," is never left dangling */}
              <br />
              <em className="bg-[linear-gradient(90deg,var(--color-accent-strong),var(--color-accent-light))] bg-clip-text font-medium text-transparent">
                Setup, memory or money.
              </em>
            </h1>
          </div>
        </section>

        {/* Comparison */}
        <section className="relative pb-24 max-lg:pb-16 max-md:pb-12" id="comparison">
          <div className={CONTAINER}>
            <CompareTable />
            <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[0.78rem] text-fg-muted">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-fg">
                    <Check size={9} />
                  </span>
                  Yes
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="rounded-full border border-[rgba(245,181,68,0.35)] px-1.5 text-[0.66rem] text-key-primary">Partly</span>
                  Some editions or with a plugin
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <X size={11} className="text-fg-faint" /> No
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-fg-faint">—</span> Not confirmed
                </span>
              </div>
              <span className="text-fg-faint">Prices in US dollars, as of {COMPARED_ON}</span>
            </div>
          </div>
        </section>

        {/* The problem */}
        <section className={SECTION} id="problem">
          <div className={CONTAINER}>
            <SectionHeader
              badge="The problem"
              title="Three taxes every Postgres developer pays"
              description="Pick any popular client and you pay at least one of them."
            />
            <ul data-reveal="stagger" className="grid grid-cols-3 gap-5 max-[861px]:grid-cols-1">
              {PROBLEMS.map(({ visual, tag, title, text, answer }) => (
                <li key={tag} className={CARD}>
                  <div className={VISUAL}>{visual}</div>
                  <div className="flex flex-1 flex-col px-6 pt-5 pb-6">
                    <span className="font-mono text-[0.72rem] tracking-[0.04em] text-fg-faint uppercase">{tag}</span>
                    <h3 className="mt-2 mb-2 text-[1.15rem] font-[650] tracking-[-0.015em] text-fg">{title}</h3>
                    <p className="mb-5 text-[0.925rem] leading-[1.6] text-fg-secondary">{text}</p>
                    <p className="mt-auto flex gap-2 border-t border-[rgba(255,255,255,0.06)] pt-4 text-[0.875rem] leading-snug text-accent-pale">
                      <Check size={15} className="mt-[0.15rem] shrink-0 text-accent-light" />
                      {answer}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>



        {/* Call to action */}
        <section className={SECTION}>
          <div className={CONTAINER}>
            <div
              data-reveal
              className="relative overflow-hidden rounded-[20px] border border-[rgb(var(--accent-rgb)/0.25)] bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgb(var(--accent-rgb)/0.14),transparent_70%)] px-8 py-16 text-center max-md:px-5 max-md:py-12"
            >
              <h2 className="font-display text-[2.6rem] leading-tight font-bold tracking-[-0.025em] text-fg max-md:text-3xl">
                Stop setting up.{" "}
                <em className="bg-[linear-gradient(90deg,var(--color-accent-strong),var(--color-accent-light))] bg-clip-text font-medium text-transparent">
                  Start querying.
                </em>
              </h2>
              <p className="mx-auto mt-3 max-w-[460px] text-[0.95rem] text-fg-secondary">
                {windowsSize} download. Postgres in one click. Free forever.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                {/* A light sweeps across the button on hover */}
                <a
                  href="/download"
                  className="group/dl relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-[11px] bg-accent px-7 font-mono text-[0.95rem] font-bold text-accent-fg shadow-[0_0_0_1px_rgb(var(--accent-pale-rgb)/0.5)_inset,0_10px_40px_-8px_rgb(var(--accent-rgb)/0.55)] [transition:background_0.2s_ease,transform_0.15s_ease,box-shadow_0.2s_ease] hover:bg-accent-hover hover:shadow-[0_0_0_1px_rgb(var(--accent-pale-rgb)/0.6)_inset,0_14px_50px_-6px_rgb(var(--accent-rgb)/0.7)] active:[transform:scale(0.97)]"
                >
                  <span
                    className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)] [transform:translateX(-100%)] [transition:transform_0.7s_ease] group-hover/dl:[transform:translateX(400%)] motion-reduce:hidden"
                    aria-hidden="true"
                  />
                  <Download size={17} className="[transition:transform_0.2s_ease] group-hover/dl:translate-y-0.5" />
                  Download free
                </a>
                <a
                  href={PRODUCT.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-[11px] border border-[rgba(255,255,255,0.12)] px-6 text-[0.9rem] font-medium text-fg-secondary [transition:border-color_0.15s_ease,color_0.15s_ease] hover:border-[rgba(255,255,255,0.25)] hover:text-white"
                >
                  <Github size={16} /> Star on GitHub
                </a>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[0.8rem] text-fg-muted">
                <span className="inline-flex items-center gap-2.5" aria-label="Windows, macOS and Linux">
                  <WindowsIcon size={14} />
                  <AppleIcon size={14} />
                  <LinuxIcon size={14} />
                </span>
                <span className="text-fg-faint">·</span>
                <span className="font-mono">v{downloads.version}</span>
                <span className="text-fg-faint">·</span>
                <span>MIT licensed</span>
              </div>
            </div>

            <div className="mt-12 text-[0.75rem] leading-relaxed text-fg-faint">
              <span className="mr-2">Sources ({COMPARED_ON}):</span>
              {SOURCES.map((s, i) => (
                <span key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-[rgba(255,255,255,0.15)] underline-offset-2 hover:text-fg-secondary">
                    {s.label}
                  </a>
                  {i < SOURCES.length - 1 && " · "}
                </span>
              ))}
              . Product names are trademarks of their owners. Spotted something out of date?{" "}
              <a href={`${PRODUCT.github}/issues/new/choose`} target="_blank" rel="noopener noreferrer" className="underline decoration-[rgba(255,255,255,0.15)] underline-offset-2 hover:text-fg-secondary">
                Tell us
              </a>
              .
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
