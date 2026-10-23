"use client";

import { useState } from "react";
import {
  FEATURES,
  FEATURE_CATEGORIES,
  type FeatureCategory,
  type Feature,
} from "../config/product";
import {
  Table,
  Columns,
  Code,
  FileJson,
  Filter,
  Eye,
  Upload,
  Settings,
  Check,
  Layers,
  ChevronRight,
  Database,
  ArrowRightLeft,
  Sparkles,
} from "./Icons";
import styles from "./FeaturesSection.module.css";

const categoryIcons: Record<FeatureCategory, React.FC<{ size?: number }>> = {
  "data-editing": Table,
  "schema-management": Columns,
  "query-tools": Code,
  "data-types": FileJson,
  navigation: Filter,
  visualization: Eye,
  "import-export": Upload,
  advanced: Settings,
};

const categoryOrder: FeatureCategory[] = [
  "data-editing",
  "schema-management",
  "query-tools",
  "data-types",
  "navigation",
  "visualization",
  "import-export",
  "advanced",
];

export default function FeaturesSection() {
  const [activeCategory, setActiveCategory] =
    useState<FeatureCategory>("navigation");

  const featuresInCategory = FEATURES.filter(
    (f) => f.category === activeCategory
  );

  const catMeta = FEATURE_CATEGORIES[activeCategory];

  return (
    <section className="section" id="features">
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <span className="section-badge">Features</span>
          <h2 className="section-title">
            Everything you need to manage PostgreSQL
          </h2>
          <p className="section-description">
            Combining the best of Supabase Table Editor and pgAdmin 4 into one
            cohesive experience. Every feature below is built for speed and
            clarity.
          </p>
        </div>

        {/* Category Tabs */}
        <div className={styles.categories} role="tablist">
          {categoryOrder.map((cat) => {
            const Icon = categoryIcons[cat];
            const meta = FEATURE_CATEGORIES[cat];
            return (
              <button
                key={cat}
                className={`${styles.categoryTab} ${
                  activeCategory === cat ? styles.active : ""
                }`}
                onClick={() => setActiveCategory(cat)}
                role="tab"
                aria-selected={activeCategory === cat}
              >
                <Icon size={16} />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {/* Category Description Banner */}
        <div className={styles.categoryHeader}>
          <h3 className={styles.categoryTitle}>{catMeta.label}</h3>
          <p className={styles.categoryDesc}>{catMeta.description}</p>
        </div>

        {/* 
          Feature Cards Grid:
          When a category contains 2 features, they render in a balanced 2-column layout.
          Neither card spans full width, eliminating asymmetric empty spaces.
        */}
        <div
          className={`${styles.featureGrid} ${
            featuresInCategory.length === 2 ? styles.balancedGrid : ""
          }`}
        >
          {featuresInCategory.map((feature, index) => {
            // Only span full width if there is a single card or an odd 3+ layout
            const isFeatured =
              featuresInCategory.length === 1 ||
              (featuresInCategory.length >= 3 && index === 0);

            return (
              <FeatureCard
                key={feature.id}
                feature={feature}
                featured={isFeatured}
              />
            );
          })}
        </div>

        {/* Compact All-Features Summary Pills */}
        <div className={styles.allFeatures}>
          <h3 className={styles.allFeaturesTitle}>
            <Layers size={18} />
            All {FEATURES.length} features at a glance
          </h3>
          <div className={styles.featurePills}>
            {FEATURES.map((f) => (
              <span key={f.id} className={styles.featurePill}>
                <Check size={12} />
                {f.title}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * FeatureCard Component:
 * Displays individual features with tier badge, title, description,
 * rich contextual UI preview widgets (e.g. Visual Filter Builder & Smart Pagination),
 * and detail bullet lists.
 */
function FeatureCard({
  feature,
  featured,
}: {
  feature: Feature;
  featured: boolean;
}) {
  const tierLabels: Record<1 | 2 | 3, string> = {
    1: "Core",
    2: "Power",
    3: "Premium",
  };

  return (
    <article
      className={`${styles.featureCard} ${featured ? styles.featured : ""}`}
    >
      <div className={styles.featureContent}>
        {/* Top Header with Tier Badge */}
        <div className={styles.featureTop}>
          <span className={styles.tierBadge} data-tier={feature.tier}>
            {tierLabels[feature.tier]}
          </span>
          <span className={styles.featureCategoryTag}>PostgreSQL Native</span>
        </div>

        <h4 className={styles.featureTitle}>{feature.title}</h4>
        <p className={styles.featureDesc}>{feature.description}</p>

        {/* ========================================================
            Contextual Visual Mockup Previews:
            Brings the features to life with realistic GUI controls
            ======================================================== */}
        
        {/* Preview: Visual Filter Builder */}
        {feature.id === "filtering-sorting" && (
          <div className={styles.previewWidget}>
            <div className={styles.widgetHeader}>
              <span className={styles.widgetTitle}>Active Filter Conditions</span>
              <span className={styles.widgetBadge}>Real-time AST</span>
            </div>

            <div className={styles.filterRulesList}>
              {/* Filter Chip 1 */}
              <div className={styles.filterChip}>
                <span className={styles.filterField}>status</span>
                <span className={styles.filterOp}>=</span>
                <span className={styles.filterValue}>&apos;ACTIVE&apos;</span>
                <span className={styles.filterDismiss}>✕</span>
              </div>

              {/* Filter Chip 2 */}
              <div className={styles.filterChip}>
                <span className={styles.filterField}>latency</span>
                <span className={styles.filterOp}>&lt;</span>
                <span className={styles.filterValue}>3.0ms</span>
                <span className={styles.filterDismiss}>✕</span>
              </div>

              <button type="button" className={styles.addFilterBtn}>
                + Add Condition
              </button>
            </div>

            <div className={styles.filterFooter}>
              <span className={styles.filterSortTag}>
                Sort: <strong>created_at</strong> <span style={{ color: "#10b981" }}>DESC ↓</span>
              </span>
              <span className={styles.filterMatchCount}>
                ✓ <strong>142</strong> / 1,500 rows match
              </span>
            </div>
          </div>
        )}

        {/* Preview: Smart Pagination */}
        {feature.id === "pagination" && (
          <div className={styles.previewWidget}>
            <div className={styles.widgetHeader}>
              <span className={styles.widgetTitle}>Cursor Pagination Bar</span>
              <span className={styles.widgetBadge}>Sub-ms Scan</span>
            </div>

            <div className={styles.paginationPreviewRow}>
              <div className={styles.paginationStats}>
                Showing <strong>1 – 50</strong> of <strong>2,845</strong> rows
              </div>

              <div className={styles.paginationButtons}>
                <button type="button" className={styles.pageBtn}>‹ Prev</button>
                <span className={`${styles.pagePill} ${styles.pagePillActive}`}>1</span>
                <span className={styles.pagePill}>2</span>
                <span className={styles.pagePill}>3</span>
                <span className={styles.pageEllipsis}>...</span>
                <span className={styles.pagePill}>57</span>
                <button type="button" className={styles.pageBtn}>Next ›</button>
              </div>
            </div>

            <div className={styles.paginationFooter}>
              <span className={styles.pageSizePill}>
                Limit: <strong>50 rows / page ▾</strong>
              </span>
              <span className={styles.paginationTiming}>Index Seek: <strong>0.8ms</strong></span>
            </div>
          </div>
        )}

        {/* Preview: Inline Cell Editing */}
        {feature.id === "inline-editing" && (
          <div className={styles.previewWidget}>
            <div className={styles.widgetHeader}>
              <span className={styles.widgetTitle}>Inline Spreadsheet Mutation</span>
              <span className={styles.widgetBadge}>Auto-Save</span>
            </div>
            <div className={styles.inlineEditMock}>
              <div className={styles.mockCellOld}>sarah@acme.dev</div>
              <div className={styles.mockArrow}>→</div>
              <div className={styles.mockCellNew}>
                <span>sarah@production.cloud</span>
                <span className={styles.cellSaveIndicator}>✓ Saved</span>
              </div>
            </div>
          </div>
        )}

        {/* Preview: Row Operations */}
        {feature.id === "row-operations" && (
          <div className={styles.previewWidget}>
            <div className={styles.widgetHeader}>
              <span className={styles.widgetTitle}>Batch Operations Bar</span>
              <span className={styles.widgetBadge}>Atomic Tx</span>
            </div>
            <div className={styles.rowOpsMock}>
              <span className={styles.rowSelectCount}>2 rows selected</span>
              <div className={styles.rowOpsActions}>
                <button type="button" className={styles.opBtn}>Duplicate</button>
                <button type="button" className={styles.opBtnDanger}>Delete (2)</button>
              </div>
            </div>
          </div>
        )}

        {/* Feature Detail Checklist */}
        <ul className={styles.featureDetails}>
          {feature.details.slice(0, 5).map((detail, i) => (
            <li key={i} className={styles.featureDetail}>
              <Check size={14} className={styles.checkIcon} />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
