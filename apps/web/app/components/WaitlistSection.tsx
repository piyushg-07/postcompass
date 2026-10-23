"use client";

import React, { useState } from "react";
import { Sparkles, Check, ArrowRightLeft, Shield, Download, Zap } from "./Icons";
import styles from "./WaitlistSection.module.css";

export default function WaitlistSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage(data.message || "You're on the early access waitlist!");
        setPosition(data.position || 1421);
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to join waitlist. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  return (
    <section className={styles.section} id="waitlist">
      <div className={styles.ambientGlow} />

      <div className={`container ${styles.container}`}>
        <div className={styles.glassCard}>
          <div className={styles.badge}>
            <span className={styles.pulseDot} />
            <Sparkles size={13} />
            <span>Priority Early Access</span>
          </div>

          <h2 className={styles.title}>
            Be the First to Experience{" "}
            <span className={styles.titleGradient}>Local-First Postgres.</span>
          </h2>

          <p className={styles.description}>
            Join 1,420+ backend engineers, founders, and database architects. Enter your name and email to receive early access binaries and cloud connector templates.
          </p>

          {status === "success" ? (
            <div className={styles.successCard}>
              <div className={styles.successIconWrap}>
                <Check size={24} className={styles.successIcon} />
              </div>
              <h3 className={styles.successHeading}>You are on the Priority List!</h3>
              <p className={styles.successText}>
                {name ? `Thank you, ${name}! ` : ""}We have reserved position <strong>#{position}</strong> for you. An invitation with download credentials will be sent to <strong>{email}</strong>.
              </p>
              <div className={styles.successMeta}>
                <span className={styles.successMetaItem}>✓ Stored in local spreadsheet</span>
                <span className={styles.successMetaItem}>✓ Zero spam guarantee</span>
              </div>
              <button
                type="button"
                className={styles.resetBtn}
                onClick={() => {
                  setStatus("idle");
                  setName("");
                  setEmail("");
                }}
              >
                Add another team member
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <div className={styles.fieldWrap}>
                  <label htmlFor="waitlist-name" className={styles.label}>
                    Your Name
                  </label>
                  <input
                    id="waitlist-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Piyush (optional)"
                    className={styles.input}
                    disabled={status === "loading"}
                  />
                </div>

                <div className={styles.fieldWrap}>
                  <label htmlFor="waitlist-email" className={styles.label}>
                    Work or Personal Email <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="waitlist-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.dev"
                    className={styles.input}
                    disabled={status === "loading"}
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className={styles.submitBtn}
                >
                  <span>{status === "loading" ? "Joining..." : "Get Early Access"}</span>
                  <span className={styles.submitArrow}>→</span>
                </button>
              </div>

              {status === "error" && (
                <div className={styles.errorAlert} role="alert">
                  {message}
                </div>
              )}

              <div className={styles.formFooter}>
                <div className={styles.guarantee}>
                  <Shield size={14} className={styles.guaranteeIcon} />
                  <span>100% data privacy. Stored securely in our spreadsheet database.</span>
                </div>
                <a
                  href="/api/waitlist?format=csv"
                  className={styles.spreadsheetLink}
                  title="Download the live waitlist CSV spreadsheet"
                >
                  <Download size={13} />
                  <span>Export Spreadsheet (.csv)</span>
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
