"use client";

import { useState } from "react";
import { FAQ_ITEMS } from "../config/product";
import { ChevronDown } from "./Icons";
import styles from "./FaqSection.module.css";

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="section" id="faq">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">FAQ</span>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-description">
            Everything you need to know about PostCompass, security, and
            compatibility.
          </p>
        </div>

        <div className={styles.accordion}>
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className={`${styles.item} ${isOpen ? styles.open : ""}`}
              >
                <button
                  className={styles.question}
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    size={18}
                    className={`${styles.icon} ${isOpen ? styles.rotate : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className={styles.answer}>
                    <p>{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
