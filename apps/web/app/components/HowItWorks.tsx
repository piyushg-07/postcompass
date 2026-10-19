"use client";

import { useState } from "react";
import { HOW_IT_WORKS_STEPS } from "../config/product";
import { Check, Copy, Terminal, Server, Table, Zap, Sparkles } from "./Icons";
import styles from "./HowItWorks.module.css";

const STEP_EXTRAS: Record<number, { badge: string; tags?: string[] }> = {
  1: { badge: "Zero Setup" },
  2: { badge: "Local & Cloud DB" },
  3: { badge: "Spreadsheet Speed", tags: ["Inline editing", "Optimistic auto-save", "Visual JSONB tree"] },
  4: { badge: "SQL & Plan Analyzer", tags: ["Visual EXPLAIN tree", "Schema ERD", "CSV & Parquet export"] },
};

export default function HowItWorks() {
  return (
    <section className="section" id="how-it-works">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">How It Works</span>
          <h2 className="section-title">
            From install to insight in minutes
          </h2>
          <p className="section-description">
            PostCompass is designed to get you productive immediately. No
            configuration ceremony, no lengthy setup — connect and start
            working.
          </p>
        </div>

        <div className={styles.steps}>
          {HOW_IT_WORKS_STEPS.map((step, index) => {
            const extra = STEP_EXTRAS[step.step];
            return (
              <div key={step.step} className={styles.step}>
                <div className={styles.stepIndicator}>
                  <span className={styles.stepNumber}>{step.step}</span>
                  {index < HOW_IT_WORKS_STEPS.length - 1 && (
                    <div className={styles.stepLine} />
                  )}
                </div>
                <div className={styles.stepContent}>
                  <div className={styles.stepHeader}>
                    <h3 className={styles.stepTitle}>{step.title}</h3>
                    {extra?.badge && (
                      <span className={styles.stepBadge}>{extra.badge}</span>
                    )}
                  </div>
                  <p className={styles.stepDesc}>{step.description}</p>
                  
                  {step.code ? (
                    <CodeBlock
                      code={step.code}
                      title={step.step === 1 ? "CLI INSTALL" : "POSTGRESQL CONNECTION URI"}
                      icon={step.step === 1 ? Terminal : Server}
                    />
                  ) : extra?.tags ? (
                    <div className={styles.stepFeatureList}>
                      {extra.tags.map((tag) => (
                        <span key={tag} className={styles.stepFeatureTag}>
                          <Check size={13} style={{ color: "var(--accent)" }} />
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CodeBlock({
  code,
  title,
  icon: HeaderIcon,
}: {
  code: string;
  title: string;
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={styles.codeContainer}>
      <div className={styles.codeBar}>
        <div className={styles.codeTitle}>
          <HeaderIcon size={13} style={{ color: "var(--accent)" }} />
          <span>{title}</span>
        </div>
        <button
          className={`${styles.codeCopyBtn} ${copied ? styles.codeCopied : ""}`}
          onClick={handleCopy}
          aria-label="Copy code snippet"
        >
          {copied ? (
            <>
              <Check size={12} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <pre className={styles.codeScroll}>
        <code>
          {code.split("\n").map((line, i) => (
            <div key={i}>
              {line.startsWith("#") ? (
                <span className="code-comment">{line}</span>
              ) : line.includes("://") ? (
                <span className="code-string">{line}</span>
              ) : (
                <span>{line}</span>
              )}
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
