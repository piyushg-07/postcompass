"use client";

import { useEffect, useState } from "react";
import {
  PRODUCT,
  RELEASES_URL,
  detectPlatform,
  type Platform,
  type PlatformDownloads,
  type ReleaseAsset,
} from "@/config/product";
import {
  WindowsIcon,
  AppleIcon,
  LinuxIcon,
  Download,
  ChevronDown,
} from "@/components/ui/Icons";
import SectionHeader from "@/components/ui/SectionHeader";

const ICONS: Record<
  Platform,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  windows: WindowsIcon,
  macos: AppleIcon,
  linux: LinuxIcon,
};

const SIZE = "ml-auto font-mono text-[0.75rem]";
const ASSET =
  "group flex items-center gap-[0.6rem] rounded-[8px] px-[0.6rem] py-[0.55rem] text-[0.875rem] text-fg-secondary [transition:color_0.15s_ease,background_0.15s_ease] hover:bg-[rgba(255,255,255,0.04)] hover:text-fg";

interface Props {
  asPage?: boolean;
  downloads: { version: string; platforms: PlatformDownloads[] };
}

export default function DownloadSection({ asPage = false, downloads }: Props) {
  // Every card gets this many "other format" rows (empty ones are invisible) so all cards are the same height
  const extraRows = Math.max(
    ...downloads.platforms.map((d) => d.assets.length - 1),
  );
  const [detected, setDetected] = useState<Platform | null>(null);
  const onMac = detected === "macos";

  useEffect(() => {
    setDetected(detectPlatform(navigator.userAgent));
  }, []);

  return (
    <section
      className={`relative ${asPage ? "pt-36 pb-24 max-[900px]:pt-28 max-lg:pb-16 max-md:pb-12" : "py-24 max-lg:py-16 max-md:py-12"}`}
      id="download"
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 max-md:px-4">
        <SectionHeader
          as={asPage ? "h1" : "h2"}
          badge={<>Download · v{downloads.version}</>}
          title="Get PostCompass"
          description="Free and open source. Pick the installer for your system."
        />

        {/* On a Mac the command is the better path (no "Open Anyway" step), so it leads; elsewhere the installers do */}
        {onMac && (
          <>
            <InstallCommand detected={detected} recommended />
            <p className="mt-10 mb-4 text-center text-[0.85rem] text-fg-muted">Or download an installer</p>
          </>
        )}

        <div
          className="grid grid-cols-3 items-stretch gap-5 max-[900px]:grid-cols-1"
          data-reveal="stagger"
        >
          {downloads.platforms.map((d) => {
            const Icon = ICONS[d.platform];
            const isDetected = detected === d.platform;
            const [primary, ...rest] = d.assets;
            return (
              <div
                key={d.platform}
                className={`relative flex h-full flex-col gap-5 rounded-[16px] border px-6 pt-7 pb-5 [transition:border-color_0.2s_ease,transform_0.2s_ease] hover:[transform:translateY(-2px)] ${
                  isDetected
                    ? "border-[rgba(16,185,129,0.4)] bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(16,185,129,0.015))] shadow-[0_0_60px_-30px_rgba(16,185,129,0.6)] before:absolute before:-top-px before:right-[18%] before:left-[18%] before:h-px before:bg-[linear-gradient(90deg,transparent,#34d399,transparent)] before:content-['']"
                    : "border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))] hover:border-[rgba(255,255,255,0.14)]"
                }`}
              >
                <div className="flex items-center gap-[0.85rem]">
                  <span
                    className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border ${
                      isDetected
                        ? "border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.12)] text-[#6ee7b7]"
                        : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] text-fg"
                    }`}
                  >
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3 className="m-0 text-[1.1rem] font-[650] text-fg">
                      {d.name}
                    </h3>
                    <p className="mt-[0.15rem] text-[0.8125rem] text-fg-muted">
                      {d.requirement}
                    </p>
                  </div>
                  {isDetected && (
                    <span className="ml-auto rounded-full bg-accent-muted px-[0.55rem] py-[0.2rem] text-[0.72rem] font-semibold whitespace-nowrap text-accent-hover">
                      Your system
                    </span>
                  )}
                </div>

                {primary && (
                  <a
                    href={primary.url}
                    className={`flex h-[2.9rem] items-center gap-[0.55rem] rounded-[10px] px-4 text-[0.9rem] font-semibold [transition:background_0.2s_ease,border-color_0.2s_ease] ${
                      isDetected
                        ? "border-none bg-accent text-[#03130c] hover:bg-accent-hover"
                        : "border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] text-fg hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.08)]"
                    }`}
                  >
                    <Download size={15} />
                    <span>{primary.label}</span>
                    {primary.size && (
                      <span
                        className={`${SIZE} ${isDetected ? "text-[rgba(3,19,12,0.7)]" : "text-fg-muted"}`}
                      >
                        {primary.size}
                      </span>
                    )}
                  </a>
                )}

                <ul className="flex flex-1 flex-col gap-[2px] border-t border-[rgba(255,255,255,0.06)] pt-3">
                  <li
                    className="mb-[0.35rem] px-[0.6rem] text-[0.7rem] font-semibold tracking-[0.06em] text-fg-faint uppercase"
                    aria-hidden="true"
                  >
                    {rest.length === 1 ? "Also available" : "Other formats"}
                  </li>
                  {rest.map((a: ReleaseAsset) => (
                    <li key={a.url}>
                      <a href={a.url} className={ASSET}>
                        <span className="font-medium">{a.label}</span>
                        <span className="text-[0.8rem] text-fg-faint">
                          {a.note}
                        </span>
                        {a.size && (
                          <span className={`${SIZE} text-fg-muted`}>
                            {a.size}
                          </span>
                        )}
                        <Download
                          size={13}
                          className="text-fg-faint group-hover:text-accent-hover"
                        />
                      </a>
                    </li>
                  ))}
                  {Array.from({ length: extraRows - rest.length }, (_, i) => (
                    <li
                      key={`spacer-${i}`}
                      className="invisible"
                      aria-hidden="true"
                    >
                      <span className={ASSET}>&nbsp;</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {!onMac && <InstallCommand detected={detected} />}
        <InstallGuide detected={detected} />
      </div>
    </section>
  );
}

// ── One-command install ────────────────────────────────────────────────────────

const SHELL_COMMAND = `curl -fsSL ${PRODUCT.website}/install.sh | sh`;
const POWERSHELL_COMMAND = `irm ${PRODUCT.website}/install.ps1 | iex`;

/** The terminal alternative to the installers: one line, latest version, no security prompts. */
function InstallCommand({ detected, recommended = false }: { detected: Platform | null; recommended?: boolean }) {
  const [choice, setChoice] = useState<"windows" | "unix" | null>(null);
  const shown = choice ?? (detected === "windows" ? "windows" : detected ? "unix" : "windows");
  const options = [
    { id: "windows", label: "Windows", Icon: WindowsIcon },
    { id: "unix", label: "macOS & Linux", Icon: AppleIcon },
  ] as const;

  return (
    <div
      className={`rounded-[14px] border px-6 py-5 max-md:px-4 ${
        recommended
          ? "border-[rgba(16,185,129,0.4)] bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(16,185,129,0.015))] shadow-[0_0_60px_-30px_rgba(16,185,129,0.6)]"
          : "mt-7 border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)]"
      }`}
      data-reveal
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[0.95rem] font-semibold text-fg">
            {recommended ? "Install with one command" : "Or install with one command"}
            {recommended && (
              <span className="rounded-full bg-accent-muted px-[0.55rem] py-[0.2rem] text-[0.72rem] font-semibold text-accent-hover">
                Recommended for Mac
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[0.85rem] text-fg-muted">
            {recommended
              ? "Installs the latest version and opens it, with no “Open Anyway” step. Paste it into Terminal."
              : `Always the latest version, with no security prompts. Paste it into ${shown === "windows" ? "PowerShell" : "Terminal"}.`}
          </p>
        </div>
        <div role="tablist" aria-label="Operating system" className="flex w-fit gap-1 rounded-[10px] border border-[rgba(255,255,255,0.08)] p-1">
          {options.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={shown === id}
              onClick={() => setChoice(id)}
              // The selected system is highlighted in the brand green, so it's clear which command is shown
              className={`inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[0.85rem] font-medium [transition:background_0.15s_ease,color_0.15s_ease] ${
                shown === id
                  ? "bg-accent-muted text-accent-hover shadow-[inset_0_0_0_1px_rgba(52,211,153,0.4)]"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <CodeLine code={shown === "windows" ? POWERSHELL_COMMAND : SHELL_COMMAND} />
      </div>
    </div>
  );
}

// ── First-launch install guide ─────────────────────────────────────────────────

type Step = { text: React.ReactNode; code?: string };

/** Per-platform steps past the "unknown developer" warnings, since the installers aren't code-signed yet. */
const GUIDE: Record<
  Platform,
  { title: string; steps: Step[]; extra?: { title: string; steps: Step[] }[] }
> = {
  windows: {
    title: "Windows 10 and 11",
    steps: [
      {
        text: (
          <>
            Run the <em>.exe</em> installer (or the <em>.msi</em>).
          </>
        ),
      },
      {
        text: (
          <>
            If Windows shows <em>Windows protected your PC</em>, click{" "}
            <em>More info</em>, then <em>Run anyway</em>.
          </>
        ),
      },
      {
        text: (
          <>Finish the installer and open PostCompass from the Start menu.</>
        ),
      },
    ],
  },
  macos: {
    title: "macOS (Apple Silicon and Intel)",
    steps: [
      {
        text: (
          <>
            Open the <em>.dmg</em> and drag PostCompass into{" "}
            <em>Applications</em>.
          </>
        ),
      },
      {
        text: (
          <>
            Open PostCompass. If macOS says it can&apos;t verify the developer,
            click <em>Done</em>.
          </>
        ),
      },
      {
        text: (
          <>
            Open <em>System Settings → Privacy &amp; Security</em>, scroll down
            and click <em>Open Anyway</em>, then confirm.
          </>
        ),
      },
      {
        text: (
          <>
            If macOS says the app <em>is damaged and can&apos;t be opened</em>,
            run this in Terminal and open it again:
          </>
        ),
        code: "xattr -cr /Applications/PostCompass.app",
      },
    ],
  },
  linux: {
    title: "Linux (64-bit)",
    steps: [],
    extra: [
      {
        title: "AppImage (any distribution)",
        steps: [
          {
            text: <>Make it executable and run it:</>,
            code: "chmod +x PostCompass_*.AppImage && ./PostCompass_*.AppImage",
          },
          {
            text: (
              <>
                If it complains about FUSE, install it (on Ubuntu 24.04 the
                package is <em>libfuse2t64</em>):
              </>
            ),
            code: "sudo apt install libfuse2",
          },
        ],
      },
      {
        title: "Debian / Ubuntu (.deb)",
        steps: [
          {
            text: <>Install with apt:</>,
            code: "sudo apt install ./PostCompass_*_amd64.deb",
          },
        ],
      },
      {
        title: "Fedora / RHEL (.rpm)",
        steps: [
          {
            text: <>Install with dnf:</>,
            code: "sudo dnf install ./PostCompass-*.x86_64.rpm",
          },
        ],
      },
    ],
  },
};

const ORDER: Platform[] = ["windows", "macos", "linux"];

function InstallGuide({ detected }: { detected: Platform | null }) {
  const [tab, setTab] = useState<Platform | null>(null);
  const active = tab ?? detected ?? "windows";

  return (
    // Collapsed by default to keep the section calm; <details> keeps the steps in the HTML for search engines
    <details
      className="group mt-7 rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] [transition:border-color_0.2s_ease] open:border-[rgba(255,255,255,0.12)] [&_em]:font-medium [&_em]:text-fg [&_em]:not-italic"
      data-reveal
    >
      <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-4 max-md:px-4 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[0.95rem] font-semibold text-fg">
            Installing for the first time?
          </span>
          <span className="text-[0.85rem] text-fg-muted">
            PostCompass isn&apos;t code-signed yet, so your system shows a
            one-time warning. See how to get past it.
          </span>
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 text-fg-muted [transition:transform_0.2s_ease] group-open:[transform:rotate(180deg)] group-open:text-accent-hover"
        />
      </summary>

      <div className="border-t border-[rgba(255,255,255,0.06)] px-6 pt-5 pb-6 max-md:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.8rem] font-semibold tracking-[0.05em] text-fg-faint uppercase">
            {GUIDE[active].title}
          </p>
          <div
            role="tablist"
            aria-label="Operating system"
            className="flex w-fit gap-1 rounded-[10px] border border-[rgba(255,255,255,0.08)] p-1"
          >
            {ORDER.map((p) => {
              const Icon = ICONS[p];
              const selected = p === active;
              return (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  id={`install-tab-${p}`}
                  aria-selected={selected}
                  aria-controls={`install-panel-${p}`}
                  onClick={() => setTab(p)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[0.85rem] font-medium [transition:background_0.15s_ease,color_0.15s_ease] ${
                    selected
                      ? "bg-[rgba(255,255,255,0.08)] text-fg"
                      : "text-fg-muted hover:text-fg"
                  }`}
                >
                  <Icon size={13} />
                  {p === "macos"
                    ? "macOS"
                    : p === "windows"
                      ? "Windows"
                      : "Linux"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Every panel stays in the HTML (only hidden), so the steps are readable without switching tabs */}
        {ORDER.map((p) => {
          const guide = GUIDE[p];
          return (
            <div
              key={p}
              role="tabpanel"
              id={`install-panel-${p}`}
              aria-labelledby={`install-tab-${p}`}
              hidden={p !== active}
              className="mt-6"
            >
              {guide.steps.length > 0 && <Steps steps={guide.steps} />}
              {guide.extra && (
                <div className="grid grid-cols-3 gap-6 max-[900px]:grid-cols-1">
                  {guide.extra.map((group) => (
                    <div key={group.title}>
                      <p className="mb-3 text-[0.95rem] font-semibold text-fg">
                        {group.title}
                      </p>
                      <Steps steps={group.steps} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <p className="mt-6 text-[0.85rem] text-fg-muted">
          Still stuck?{" "}
          <a
            href={`${PRODUCT.github}/issues/new/choose`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-hover hover:underline"
          >
            Open an issue
          </a>{" "}
          or browse{" "}
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-hover hover:underline"
          >
            all releases
          </a>
          .
        </p>
      </div>
    </details>
  );
}

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, i) => (
        <li
          key={i}
          className="flex gap-3 text-[0.925rem] leading-relaxed text-fg-secondary"
        >
          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.1)] text-[0.75rem] font-semibold text-accent-hover">
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span>{step.text}</span>
            {step.code && <CodeLine code={step.code} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Terminal-style colours for a shell command: programs green, flags purple, URLs blue, pipes dimmed. */
function highlight(code: string) {
  let program = true; // the first word, and the word after each "|", is the program being run
  return code.split(" ").map((word, i) => {
    let className = "text-fg";
    if (word === "|") {
      className = "text-fg-faint";
      program = true;
    } else if (program) {
      className = "font-semibold text-accent-hover";
      program = false;
    } else if (word.startsWith("-")) className = "text-[#c792ea]";
    else if (word.startsWith("http")) className = "text-[#7dd3fc]";
    return (
      <span key={i}>
        {i > 0 && " "}
        <span className={className}>{word}</span>
      </span>
    );
  });
}

function CodeLine({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.35)] py-1.5 pr-1.5 pl-3">
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[0.8rem] whitespace-nowrap">{highlight(code)}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="shrink-0 rounded-[6px] px-2.5 py-1 text-[0.75rem] font-medium text-fg-muted [transition:background_0.15s_ease,color_0.15s_ease] hover:bg-[rgba(255,255,255,0.06)] hover:text-fg"
        aria-label={`Copy: ${code}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
