import { PRODUCT, RELEASES_URL } from "../config/product";
import { Github } from "./Icons";
import styles from "./Footer.module.css";

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

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.top}>
          <div className={styles.brand}>
            <a href="/" className={styles.logo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={28} height={28} />
              <span>
                Post<em>Compass</em>
              </span>
            </a>
            <p className={styles.tagline}>{PRODUCT.tagline}. Free and open source.</p>
            <a href={PRODUCT.github} target="_blank" rel="noopener noreferrer" className={styles.github}>
              <Github size={15} />
              <span>Star on GitHub</span>
            </a>
          </div>

          <div className={styles.columns}>
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className={styles.colTitle}>{col.title}</h3>
                <ul className={styles.links}>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        {...("external" in l ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className={styles.link}
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

        <div className={styles.bottom}>
          <span>© 2026 Piyush Gupta · Released under the {PRODUCT.license} license</span>
          <span>v{PRODUCT.version}</span>
        </div>
      </div>
    </footer>
  );
}
