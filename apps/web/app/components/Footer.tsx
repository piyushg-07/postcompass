import { PRODUCT } from "../config/product";
import { Compass, Github } from "./Icons";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.footerInner}>
          <div className={styles.topRow}>
            {/* Brand info */}
            <div className={styles.brandCol}>
              <div className={styles.brandLogo}>
                <div className={styles.logoIconWrapper}>
                  <Compass size={18} />
                </div>
                <span className={styles.brandName}>
                  {PRODUCT.name}
                </span>
              </div>
              <p className={styles.brandDesc}>
                {PRODUCT.tagline} Built natively for engineers who demand velocity, offline control, and zero cloud lock-in.
              </p>
              <div className={styles.brandMeta}>
                <span className={styles.pulseDot} />
                <span>v{PRODUCT.version} · Open Source under MIT</span>
              </div>
            </div>

            {/* Links navigation columns */}
            <div className={styles.navColumns}>
              <div>
                <h4 className={styles.navColTitle}>
                  Product
                </h4>
                <ul className={styles.navList}>
                  <li><a href="#features" className={styles.navLink}>Features</a></li>
                  <li><a href="#demo" className={styles.navLink}>Interactive Demo</a></li>
                  <li><a href="#comparison" className={styles.navLink}>Compare vs Others</a></li>
                  <li><a href="#download" className={styles.navLink}>Downloads</a></li>
                </ul>
              </div>

              <div>
                <h4 className={styles.navColTitle}>
                  Resources
                </h4>
                <ul className={styles.navList}>
                  <li>
                    <a href={PRODUCT.github} target="_blank" rel="noopener noreferrer" className={styles.navLink}>
                      GitHub Repository
                    </a>
                  </li>
                  <li>
                    <a href={`${PRODUCT.github}/releases`} target="_blank" rel="noopener noreferrer" className={styles.navLink}>
                      Release Notes
                    </a>
                  </li>
                  <li><a href="#how-it-works" className={styles.navLink}>Quickstart Guide</a></li>
                  <li><a href="#faq" className={styles.navLink}>FAQ</a></li>
                </ul>
              </div>

              <div>
                <h4 className={styles.navColTitle}>
                  Community
                </h4>
                <ul className={styles.navList}>
                  <li>
                    <a href={`${PRODUCT.github}/issues`} target="_blank" rel="noopener noreferrer" className={styles.navLink}>
                      Report an Issue
                    </a>
                  </li>
                  <li>
                    <a href={`${PRODUCT.github}/discussions`} target="_blank" rel="noopener noreferrer" className={styles.navLink}>
                      Discussions
                    </a>
                  </li>
                  <li>
                    <a href={PRODUCT.github} target="_blank" rel="noopener noreferrer" className={styles.starLink}>
                      <Github size={14} /> Star on GitHub
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className={styles.bottomBar}>
            <p>© {new Date().getFullYear()} {PRODUCT.name}. Free and open-source software under the MIT License.</p>
            <p>Engineered with speed and precision for PostgreSQL developers worldwide.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
