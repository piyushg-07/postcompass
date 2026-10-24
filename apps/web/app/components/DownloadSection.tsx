"use client";

import { useEffect, useState } from "react";
import { RELEASES_URL, detectPlatform, type Platform, type PlatformDownloads } from "../config/product";
import { WindowsIcon, AppleIcon, LinuxIcon, Download } from "./Icons";
import SectionHeader from "./SectionHeader";

const ICONS = { windows: WindowsIcon, macos: AppleIcon, linux: LinuxIcon };

const SIZE = "ml-auto font-mono text-[0.75rem]";
const ASSET =
  "group flex items-center gap-[0.6rem] rounded-[8px] px-[0.6rem] py-[0.55rem] text-[0.875rem] text-fg-secondary [transition:color_0.15s_ease,background_0.15s_ease] hover:bg-[rgba(255,255,255,0.04)] hover:text-fg";
const TIP =
  "inline-flex items-center gap-[0.4rem] rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-[0.65rem] py-[0.3rem] text-[0.8125rem] whitespace-nowrap";

interface Props {
  asPage?: boolean;
  downloads: { version: string; platforms: PlatformDownloads[] };
}

export default function DownloadSection({ asPage = false, downloads }: Props) {
  // Every card gets this many "other format" rows (empty ones are invisible) so all cards are the same height
  const extraRows = Math.max(...downloads.platforms.map((d) => d.assets.length - 1));
  const [detected, setDetected] = useState<Platform | null>(null);

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

        <div className="grid grid-cols-3 items-stretch gap-5 max-[900px]:grid-cols-1" data-reveal="stagger">
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
                    <h3 className="m-0 text-[1.1rem] font-[650] text-fg">{d.name}</h3>
                    <p className="mt-[0.15rem] text-[0.8125rem] text-fg-muted">{d.requirement}</p>
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
                      <span className={`${SIZE} ${isDetected ? "text-[rgba(3,19,12,0.7)]" : "text-fg-muted"}`}>{primary.size}</span>
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
                  {rest.map((a) => (
                    <li key={a.url}>
                      <a href={a.url} className={ASSET}>
                        <span className="font-medium">{a.label}</span>
                        <span className="text-[0.8rem] text-fg-faint">{a.note}</span>
                        {a.size && <span className={`${SIZE} text-fg-muted`}>{a.size}</span>}
                        <Download size={13} className="text-fg-faint group-hover:text-accent-hover" />
                      </a>
                    </li>
                  ))}
                  {Array.from({ length: extraRows - rest.length }, (_, i) => (
                    <li key={`spacer-${i}`} className="invisible" aria-hidden="true">
                      <span className={ASSET}>&nbsp;</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div
          className="mt-7 flex flex-nowrap items-center gap-[0.6rem] rounded-[12px] border border-[rgba(255,255,255,0.06)] px-5 py-4 text-[0.875rem] text-fg-muted max-[1060px]:flex-wrap [&_em]:text-fg-secondary [&_em]:not-italic [&_strong]:text-fg-secondary"
          data-reveal
        >
          <p className="m-0 whitespace-nowrap">
            <strong>Not code-signed yet.</strong> On first launch:
          </p>
          <span className={TIP}>
            <WindowsIcon size={13} />
            Click <em>More info</em>, then <em>Run anyway</em>
          </span>
          <span className={TIP}>
            <AppleIcon size={13} />
            In <em>Privacy &amp; Security</em>, click <em>Open Anyway</em>
          </span>
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-[0.35rem] font-medium whitespace-nowrap text-accent-hover hover:underline"
          >
            All releases
          </a>
        </div>
      </div>
    </section>
  );
}
