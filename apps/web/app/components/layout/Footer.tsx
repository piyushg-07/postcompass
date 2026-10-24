import { PRODUCT, RELEASES_URL, getDownloads } from "@/config/product";
import { getLatestRelease } from "@/lib/release";
import { Github } from "@/components/ui/Icons";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Download", href: "/download" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "GitHub", href: PRODUCT.github, external: true },
      { label: "Releases", href: RELEASES_URL, external: true },
      { label: "Contributing", href: `${PRODUCT.github}/blob/main/CONTRIBUTING.md`, external: true },
      { label: "Report an issue", href: `${PRODUCT.github}/issues/new/choose`, external: true },
    ],
  },
];

export default async function Footer() {
  const { version } = getDownloads(await getLatestRelease());
  return (
    <footer className="mt-16 border-t border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(16,185,129,0.03),transparent_40%)] pt-14 pb-8">
      <div className="mx-auto w-full max-w-[1200px] px-6 max-md:px-4">
        <div className="flex flex-wrap justify-between gap-12 max-[640px]:flex-col max-[640px]:items-center max-[640px]:text-center">
          <div className="max-w-[320px] max-[640px]:flex max-[640px]:flex-col max-[640px]:items-center">
            <a href="/" className="inline-flex items-center gap-[0.55rem] text-[1.05rem] font-bold tracking-[-0.025em] text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={28} height={28} className="rounded-[7px]" />
              <span>
                Post<em className="font-display text-[1.08em] font-medium text-accent-hover">Compass</em>
              </span>
            </a>
            <p className="mt-[0.85rem] mb-[1.1rem] text-[0.9rem] leading-[1.6] text-fg-muted">{PRODUCT.tagline}. Free and open source.</p>
            <a
              href={PRODUCT.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[2.2rem] items-center gap-2 rounded-[8px] border border-[rgba(255,255,255,0.1)] px-[0.85rem] text-[0.85rem] font-medium text-fg-secondary [transition:border-color_0.15s_ease,color_0.15s_ease] hover:border-[rgba(255,255,255,0.22)] hover:text-white"
            >
              <Github size={15} />
              <span>Star on GitHub</span>
            </a>
          </div>

          <div className="flex gap-16 max-[640px]:justify-center max-[640px]:gap-10">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="mb-[0.9rem] text-[0.8rem] font-semibold tracking-[0.04em] text-fg-faint uppercase">{col.title}</h3>
                <ul className="flex flex-col gap-[0.6rem]">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        {...("external" in l ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="text-[0.9rem] text-fg-secondary [transition:color_0.15s_ease] hover:text-white"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-between gap-4 border-t border-[rgba(255,255,255,0.06)] pt-6 text-[0.8rem] text-fg-faint max-[640px]:flex-col max-[640px]:items-center max-[640px]:gap-2 max-[640px]:text-center">
          <span>© 2026 Piyush Gupta · Released under the {PRODUCT.license} license</span>
          <span>v{version}</span>
        </div>
      </div>
    </footer>
  );
}
