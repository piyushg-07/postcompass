"use client";

import { USE_CASES } from "../config/product";
import { Zap, Shield, Eye, ArrowRightLeft, Database } from "./Icons";
import styles from "./UseCasesSection.module.css";

const iconMap: Record<string, React.FC<{ size?: number; className?: string }>> = {
  zap: Zap,
  bug: Shield,
  gauge: Eye,
  users: Database,
  "arrow-right-left": ArrowRightLeft,
};

export default function UseCasesSection() {
  return (
    <section className="section" id="use-cases">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Workflows</span>
          <h2 className="section-title">Built for Real-World Database Engineering</h2>
          <p className="section-description">
            Whether you're developing locally or troubleshooting production issues,
            PostCompass accelerates every step of your workflow.
          </p>
        </div>

        <div className={styles.grid}>
          {USE_CASES.map((uc, index) => {
            const Icon = iconMap[uc.icon] || Zap;
            return (
              <div key={index} className={styles.card}>
                <div className={styles.header}>
                  <div className={styles.iconBox}>
                    <Icon size={20} className={styles.icon} />
                  </div>
                  <h3 className={styles.title}>{uc.title}</h3>
                </div>
                <div className={styles.body}>
                  <div className={styles.problem}>
                    <span className={styles.label}>The Challenge:</span>
                    <p>{uc.problem}</p>
                  </div>
                  <div className={styles.solution}>
                    <span className={styles.label}>PostCompass Solution:</span>
                    <p>{uc.solution}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
