"use client";

import { Check, X, Compass } from "./Icons";
import styles from "./ComparisonSection.module.css";

const comparisonData = [
  {
    feature: "Inline Spreadsheet Cell Editing",
    supabase: true,
    pgadmin: false,
    postcompass: true,
  },
  {
    feature: "Visual Schema Designer & ERD",
    supabase: false,
    pgadmin: true,
    postcompass: true,
  },
  {
    feature: "100% Offline / Local-first App",
    supabase: false,
    pgadmin: true,
    postcompass: true,
  },
  {
    feature: "Connect to Any PostgreSQL Server",
    supabase: false,
    pgadmin: true,
    postcompass: true,
  },
  {
    feature: "JSONB Tree & Array Tag Editors",
    supabase: false,
    pgadmin: false,
    postcompass: true,
  },
  {
    feature: "Visual Query Plan & EXPLAIN Tree",
    supabase: false,
    pgadmin: true,
    postcompass: true,
  },
  {
    feature: "Fast Native UI (No Web Browser lag)",
    supabase: false,
    pgadmin: false,
    postcompass: true,
  },
  {
    feature: "AI Query Generation & Autocomplete",
    supabase: true,
    pgadmin: false,
    postcompass: true,
  },
  {
    feature: "Database Maintenance (VACUUM, REINDEX)",
    supabase: false,
    pgadmin: true,
    postcompass: true,
  },
];

export default function ComparisonSection() {
  return (
    <section className="section" id="comparison">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Why PostCompass</span>
          <h2 className="section-title">The Best of Both Worlds</h2>
          <p className="section-description">
            You no longer have to compromise between modern table editing and deep
            database administration.
          </p>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.featureCol}>Feature / Capability</th>
                <th className={styles.competitorCol}>Supabase</th>
                <th className={styles.competitorCol}>pgAdmin 4</th>
                <th className={styles.highlightCol}>
                  <div className={styles.highlightHeader}>
                    <Compass size={16} />
                    <span>PostCompass</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <tr key={index} className={styles.row}>
                  <td className={styles.featureCell}>{row.feature}</td>
                  <td className={styles.statusCell}>
                    {row.supabase ? (
                      <Check className={styles.checkIcon} size={18} />
                    ) : (
                      <X className={styles.crossIcon} size={18} />
                    )}
                  </td>
                  <td className={styles.statusCell}>
                    {row.pgadmin ? (
                      <Check className={styles.checkIcon} size={18} />
                    ) : (
                      <X className={styles.crossIcon} size={18} />
                    )}
                  </td>
                  <td className={`${styles.statusCell} ${styles.highlightCell}`}>
                    {row.postcompass && (
                      <Check className={styles.highlightCheckIcon} size={20} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
