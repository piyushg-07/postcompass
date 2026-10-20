"use client";

import { useState } from "react";
import { Check, Copy } from "./Icons";
import styles from "./InteractiveDemo.module.css";

const tabs = [
  {
    id: "inline-edit",
    label: "Inline Editing",
    description: "Click any cell to edit. Changes auto-save on blur.",
  },
  {
    id: "schema",
    label: "Schema Management",
    description: "Add and modify columns through a visual form.",
  },
  {
    id: "sql",
    label: "SQL Editor",
    description: "Write queries with autocomplete and syntax highlighting.",
  },
  {
    id: "filter",
    label: "Filter & Sort",
    description: "Build complex filters without writing WHERE clauses.",
  },
];

export default function InteractiveDemo() {
  const [activeTab, setActiveTab] = useState("inline-edit");
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section className="section" id="demo">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Interactive Demo</span>
          <h2 className="section-title">See PostCompass in action</h2>
          <p className="section-description">
            Explore the core workflows that make PostCompass a faster way to
            work with PostgreSQL.
          </p>
        </div>

        {/* Tabs */}
        <div className={styles.tabs} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ""}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              suppressHydrationWarning
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className={styles.panel}>
          {activeTab === "inline-edit" && (
            <div className={styles.demoContent}>
              <div className={styles.demoLeft}>
                <h3 className={styles.demoTitle}>Spreadsheet-like editing</h3>
                <p className={styles.demoDesc}>
                  Double-click any cell to enter edit mode. Type your new value
                  and click away — the change is committed to your database
                  instantly. Specialized editors activate automatically for JSON,
                  arrays, enums, booleans, and dates.
                </p>
                <div className={styles.demoFeatures}>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> Auto-save on blur
                  </span>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> No primary key requirement
                  </span>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> Undo before commit
                  </span>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> NULL handling
                  </span>
                </div>
              </div>
              <div className={styles.demoRight}>
                <div className={styles.miniGrid}>
                  <div className={styles.miniHeader}>
                    <span>name</span>
                    <span>email</span>
                    <span>role</span>
                  </div>
                  <div className={styles.miniRow}>
                    <span>Sarah Chen</span>
                    <span>sarah@example.com</span>
                    <span className={styles.miniEnum} data-role="admin">admin</span>
                  </div>
                  <div className={`${styles.miniRow} ${styles.miniRowEditing}`}>
                    <span className={styles.miniEditing}>Marcus J▎</span>
                    <span>marcus@example.com</span>
                    <span className={styles.miniEnum} data-role="editor">editor</span>
                  </div>
                  <div className={styles.miniRow}>
                    <span>Priya Patel</span>
                    <span>priya@example.com</span>
                    <span className={styles.miniEnum} data-role="viewer">viewer</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "schema" && (
            <div className={styles.demoContent}>
              <div className={styles.demoLeft}>
                <h3 className={styles.demoTitle}>Visual column management</h3>
                <p className={styles.demoDesc}>
                  Add, rename, and modify columns through an intuitive visual
                  form. Set data types from a complete dropdown of all PostgreSQL
                  types. Configure defaults, constraints, foreign keys, and
                  identity columns — all without writing DDL.
                </p>
                <div className={styles.demoFeatures}>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> All PostgreSQL types
                  </span>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> Visual FK selector
                  </span>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> Live SQL preview
                  </span>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> Check constraints
                  </span>
                </div>
              </div>
              <div className={styles.demoRight}>
                <div className={styles.schemaForm}>
                  <div className={styles.formRow}>
                    <span className={styles.formLabel}>Column name</span>
                    <span className={styles.formInput}>avatar_url</span>
                  </div>
                  <div className={styles.formRow}>
                    <span className={styles.formLabel}>Data type</span>
                    <span className={styles.formSelect}>text ▾</span>
                  </div>
                  <div className={styles.formRow}>
                    <span className={styles.formLabel}>Default value</span>
                    <span className={styles.formInput}>NULL</span>
                  </div>
                  <div className={styles.formRow}>
                    <span className={styles.formLabel}>Nullable</span>
                    <span className={styles.formToggle} data-on="true" />
                  </div>
                  <div className={styles.formRow}>
                    <span className={styles.formLabel}>Unique</span>
                    <span className={styles.formToggle} data-on="false" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "sql" && (
            <div className={styles.demoContent}>
              <div className={styles.demoLeft}>
                <h3 className={styles.demoTitle}>Powerful SQL editor</h3>
                <p className={styles.demoDesc}>
                  Write queries with full syntax highlighting and context-aware
                  autocomplete. Run EXPLAIN ANALYZE to visualize execution plans.
                  Save frequently used queries and browse your query history.
                </p>
                <div className={styles.demoFeatures}>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> Syntax highlighting
                  </span>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> Autocomplete
                  </span>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> EXPLAIN visualizer
                  </span>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> Query history
                  </span>
                </div>
              </div>
              <div className={styles.demoRight}>
                <div className="code-block" style={{ width: "100%" }}>
                  <button
                    className="code-copy"
                    onClick={() =>
                      handleCopy(
                        'SELECT u.name, COUNT(p.id) as post_count\nFROM users u\nLEFT JOIN posts p ON p.author_id = u.id\nWHERE u.active = true\nGROUP BY u.name\nORDER BY post_count DESC\nLIMIT 10;'
                      )
                    }
                    aria-label="Copy SQL"
                  >
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
                    <div>
                      <span className="code-keyword">SELECT</span>{" "}
                      u.name, <span className="code-function">COUNT</span>
                      (p.id) <span className="code-keyword">as</span>{" "}
                      post_count
                    </div>
                    <div>
                      <span className="code-keyword">FROM</span> users u
                    </div>
                    <div>
                      <span className="code-keyword">LEFT JOIN</span> posts p{" "}
                      <span className="code-keyword">ON</span> p.author_id = u.id
                    </div>
                    <div>
                      <span className="code-keyword">WHERE</span> u.active ={" "}
                      <span className="code-number">true</span>
                    </div>
                    <div>
                      <span className="code-keyword">GROUP BY</span> u.name
                    </div>
                    <div>
                      <span className="code-keyword">ORDER BY</span>{" "}
                      post_count <span className="code-keyword">DESC</span>
                    </div>
                    <div>
                      <span className="code-keyword">LIMIT</span>{" "}
                      <span className="code-number">10</span>;
                    </div>
                  </code>
                </div>
              </div>
            </div>
          )}

          {activeTab === "filter" && (
            <div className={styles.demoContent}>
              <div className={styles.demoLeft}>
                <h3 className={styles.demoTitle}>Visual filter builder</h3>
                <p className={styles.demoDesc}>
                  Build complex query filters without writing SQL. Pick a column,
                  choose an operator, enter a value. Stack multiple AND
                  conditions. Right-click any cell to filter by its value
                  instantly.
                </p>
                <div className={styles.demoFeatures}>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> Column + operator + value
                  </span>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> Multiple conditions
                  </span>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> Filter by cell click
                  </span>
                  <span className={styles.demoFeature}>
                    <Check size={14} /> Column sort ASC/DESC
                  </span>
                </div>
              </div>
              <div className={styles.demoRight}>
                <div className={styles.filterBuilder}>
                  <div className={styles.filterRow}>
                    <span className={styles.filterCol}>role</span>
                    <span className={styles.filterOp}>equals</span>
                    <span className={styles.filterVal}>admin</span>
                    <span className={styles.filterRemove}>×</span>
                  </div>
                  <div className={styles.filterRow}>
                    <span className={styles.filterCol}>active</span>
                    <span className={styles.filterOp}>is</span>
                    <span className={styles.filterVal}>true</span>
                    <span className={styles.filterRemove}>×</span>
                  </div>
                  <div className={styles.filterRow}>
                    <span className={styles.filterCol}>created_at</span>
                    <span className={styles.filterOp}>after</span>
                    <span className={styles.filterVal}>2025-01-01</span>
                    <span className={styles.filterRemove}>×</span>
                  </div>
                  <button className={styles.filterAdd}>+ Add filter</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
