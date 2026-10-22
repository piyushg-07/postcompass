"use client";

import {
  Globe,
  Table,
  Filter,
  Columns,
  Activity,
  Upload,
  Check,
} from "./Icons";
import styles from "./FeaturesSection.module.css";

interface BentoBox {
  id: string;
  icon: React.FC<{ size?: number; className?: string }>;
  title: string;
  category: string;
  description: string;
  size: "wide" | "normal";
  tags?: string[];
  visualBadge?: string;
}

const BENTO_BOXES: BentoBox[] = [
  // Layer 1
  {
    id: "multi-cloud",
    icon: Globe,
    title: "Direct Multi-Cloud Connection",
    category: "Connectivity",
    description:
      "Connect directly from your local workstation to AWS RDS, Aurora, Supabase, Neon, Google Cloud SQL, and Docker VPS in <2ms with zero third-party proxy.",
    size: "wide",
    tags: ["AWS RDS & Aurora", "Supabase", "Neon Serverless", "Docker / VPS"],
    visualBadge: "Zero Cloud Proxy",
  },
  {
    id: "data-editing",
    icon: Table,
    title: "Spreadsheet Data Editor",
    category: "Data Mutation",
    description:
      "Click any cell to edit records like Excel. Auto-save mutations to PostgreSQL in 1.4ms with zero modal confirmation popups.",
    size: "normal",
    visualBadge: "Auto-Save in 1.4ms",
  },
  // Layer 2
  {
    id: "filter-sort",
    icon: Filter,
    title: "Multi-Column Filter & Sort",
    category: "Navigation",
    description:
      "Build complex WHERE clauses visually with type-aware operators, regex matching, and instant multi-column sorting on live tables.",
    size: "normal",
    visualBadge: "Visual SQL Builder",
  },
  {
    id: "schema-ddl",
    icon: Columns,
    title: "Schema Management & DDL",
    category: "Database Design",
    description:
      "Create, alter, and drop tables, foreign key constraints, and indexes with real-time SQL preview before committing changes.",
    size: "wide",
    tags: ["Visual DDL Builder", "Live SQL Preview", "Constraint Checks"],
    visualBadge: "Live SQL Preview",
  },
  // Layer 3
  {
    id: "explain-analyze",
    icon: Activity,
    title: "Visual EXPLAIN ANALYZE",
    category: "Diagnostics",
    description:
      "Inspect execution plans as visual interactive trees. Automatically highlight expensive sequential scans, node costs, and timing bottlenecks.",
    size: "normal",
    visualBadge: "Execution Tree",
  },
  {
    id: "import-export",
    icon: Upload,
    title: "High-Speed Import & Export",
    category: "Data Transfer",
    description:
      "Stream millions of rows utilizing the native PostgreSQL binary COPY protocol. Export to CSV, JSON, and raw SQL dumps in seconds.",
    size: "wide",
    tags: ["PostgreSQL COPY Protocol", "CSV & JSON", "SQL Dumps"],
    visualBadge: "Fast Streaming",
  },
];

export default function FeaturesSection() {
  return (
    <section className="section" id="features">
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <span className="section-badge">Capabilities</span>
          <h2 className="section-title">
            Everything you need to manage PostgreSQL
          </h2>
          <p className="section-description">
            Six essential tools organized into three seamless layers. Designed for speed, clarity, and zero developer friction.
          </p>
        </div>

        {/* 3-Layer Bento Grid */}
        <div className={styles.layersContainer}>
          {/* Layer 1 */}
          <div className={styles.layerRow}>
            {BENTO_BOXES.slice(0, 2).map((box) => renderBox(box))}
          </div>

          {/* Layer 2 */}
          <div className={styles.layerRow}>
            {BENTO_BOXES.slice(2, 4).map((box) => renderBox(box))}
          </div>

          {/* Layer 3 */}
          <div className={styles.layerRow}>
            {BENTO_BOXES.slice(4, 6).map((box) => renderBox(box))}
          </div>
        </div>
      </div>
    </section>
  );
}

function renderBox(box: BentoBox) {
  const Icon = box.icon;
  const isWide = box.size === "wide";

  return (
    <div
      key={box.id}
      className={`${styles.bentoBox} ${isWide ? styles.boxWide : styles.boxNormal}`}
    >
      {/* Tech grid texture pattern */}
      <div className={styles.cardGridPattern} />

      <div className={styles.cardContent}>
        {/* Top Bar with Icon and Category Tag */}
        <div className={styles.cardTopBar}>
          <div className={styles.iconCircle}>
            <Icon size={17} className={styles.cardIcon} />
          </div>
          {box.visualBadge && (
            <span className={styles.badgePill}>{box.visualBadge}</span>
          )}
        </div>

        <div className={styles.categoryLabel}>{box.category}</div>
        <h3 className={styles.cardTitle}>{box.title}</h3>
        <p className={styles.cardDesc}>{box.description}</p>

        {/* Optional Tags for Wide Cards */}
        {box.tags && box.tags.length > 0 && (
          <div className={styles.tagsRow}>
            {box.tags.map((t) => (
              <span key={t} className={styles.tagItem}>
                <Check size={11} style={{ color: "var(--accent)" }} />
                <span>{t}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
