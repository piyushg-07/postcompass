import { FAQ_ITEMS } from "../config/product";
import { ChevronDown } from "./Icons";
import styles from "./FaqSection.module.css";

export default function FaqSection() {
  return (
    <section className="section" id="faq">
      <div className={`container ${styles.wrap}`}>
        <div className="section-header">
          <span className="section-badge">FAQ</span>
          <h2 className="section-title">Questions, answered</h2>
        </div>

        <div className={styles.list}>
          {FAQ_ITEMS.map((item) => (
            <details key={item.question} className={styles.item}>
              <summary className={styles.question}>
                <span>{item.question}</span>
                <ChevronDown size={16} className={styles.chevron} />
              </summary>
              <p className={styles.answer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
