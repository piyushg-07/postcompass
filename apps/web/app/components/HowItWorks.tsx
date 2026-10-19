"use client";

import { useState } from "react";
import { HOW_IT_WORKS_STEPS } from "../config/product";
import { Check, Copy } from "./Icons";
import styles from "./HowItWorks.module.css";

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
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <div key={step.step} className={styles.step}>
              <div className={styles.stepIndicator}>
                <span className={styles.stepNumber}>{step.step}</span>
                {index < HOW_IT_WORKS_STEPS.length - 1 && (
                  <div className={styles.stepLine} />
                )}
              </div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.description}</p>
                {step.code && <CodeBlock code={step.code} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="code-block">
      <button className="code-copy" onClick={handleCopy} aria-label="Copy code">
        {copied ? (
          <>
            <Check size={12} /> Copied
          </>
        ) : (
          <>
            <Copy size={12} /> Copy
          </>
        )}
      </button>
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
    </div>
  );
}
