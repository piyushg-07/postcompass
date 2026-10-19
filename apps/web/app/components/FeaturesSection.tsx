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
    useState<FeatureCategory>("data-editing");

  const featuresInCategory = FEATURES.filter(
    (f) => f.category === activeCategory
  );

  const catMeta = FEATURE_CATEGORIES[activeCategory];

  return (
    <section className="section" id="features">
      <div className="container">
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

        {/* Category tabs */}
        <div className={styles.categories} role="tablist">
          {categoryOrder.map((cat) => {
            const Icon = categoryIcons[cat];
            const meta = FEATURE_CATEGORIES[cat];
            return (
              <button
                key={cat}
                className={`${styles.categoryTab} ${activeCategory === cat ? styles.active : ""}`}
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

        {/* Category description */}
        <div className={styles.categoryHeader}>
          <h3 className={styles.categoryTitle}>{catMeta.label}</h3>
          <p className={styles.categoryDesc}>{catMeta.description}</p>
        </div>

        {/* Feature list */}
        <div className={styles.featureGrid}>
          {featuresInCategory.map((feature, index) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              featured={index === 0}
            />
          ))}
        </div>

        {/* Compact all-features summary */}
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
        <div className={styles.featureTop}>
          <span
            className={styles.tierBadge}
            data-tier={feature.tier}
          >
            {tierLabels[feature.tier]}
          </span>
        </div>
        <h4 className={styles.featureTitle}>{feature.title}</h4>
        <p className={styles.featureDesc}>{feature.description}</p>
        <ul className={styles.featureDetails}>
          {feature.details.slice(0, featured ? 6 : 4).map((detail, i) => (
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
