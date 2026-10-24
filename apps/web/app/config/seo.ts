import { PRODUCT, FAQ_ITEMS } from "./product";

export const SEO_CONFIG = {
  siteName: PRODUCT.name,
  titleDefault: `${PRODUCT.name} — Fast, Modern Desktop App & GUI for PostgreSQL`,
  titleTemplate: `%s | ${PRODUCT.name}`,
  description:
    "Spin up a local PostgreSQL database in one click, connect to Supabase, Neon, AWS RDS, or any cloud, and query, edit, and visualize your data in one fast native app. Free, open source (MIT), zero telemetry, and lightweight.",
  canonicalUrl: PRODUCT.website,
  keywords: [
    "PostgreSQL",
    "Postgres",
    "Postgres GUI",
    "PostgreSQL GUI",
    "PostgreSQL client",
    "Postgres client",
    "PostgreSQL desktop app",
    "pgAdmin alternative",
    "TablePlus alternative",
    "DBeaver alternative",
    "DataGrip alternative",
    "Supabase Table Editor",
    "Neon Postgres GUI",
    "AWS RDS Postgres client",
    "Local PostgreSQL runner",
    "Postgres database manager",
    "SQL editor for PostgreSQL",
    "PostgreSQL schema designer",
    "ER diagram visualizer",
    "Explain analyze visualizer",
    "Native Postgres app",
    "Rust database client",
    "Tauri Postgres client",
    "Open source Postgres GUI",
    "Zero telemetry database client",
    "macOS Postgres GUI",
    "Windows Postgres GUI",
    "Linux Postgres GUI",
    "Database viewer",
    "PostgreSQL query tool",
  ],
  authors: [{ name: "PostCompass Team", url: PRODUCT.github }],
  creator: "PostCompass",
  publisher: "PostCompass",
  themeColor: "#09090b",
  ogImage: {
    url: `${PRODUCT.website}/screens/table-editor.webp`,
    width: 1200,
    height: 630,
    alt: "PostCompass - Fast, Modern Desktop App for PostgreSQL",
    type: "image/webp",
  },
  twitterHandle: "@postcompass",
} as const;

/**
 * Returns complete Schema.org JSON-LD structured data graph for Google and AI search engines.
 */
export function getJsonLdStructuredData() {
  const softwareAppSchema = {
    "@type": "SoftwareApplication",
    "@id": `${PRODUCT.website}#software`,
    name: PRODUCT.name,
    operatingSystem: "Windows 10+, macOS 11+ (Apple Silicon & Intel), Linux (x86_64)",
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "Database Management System",
    description: SEO_CONFIG.description,
    url: PRODUCT.website,
    downloadUrl: `${PRODUCT.website}/download`,
    softwareVersion: PRODUCT.version,
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "142",
      bestRating: "5",
      worstRating: "1",
    },
    screenshot: [
      `${PRODUCT.website}/screens/table-editor.webp`,
      `${PRODUCT.website}/screens/sql-editor.webp`,
      `${PRODUCT.website}/screens/explain-plan.webp`,
      `${PRODUCT.website}/screens/er-diagram.webp`,
      `${PRODUCT.website}/screens/cloud-providers.webp`,
    ],
    featureList: [
      "One-click local PostgreSQL 14-18 server download and runner without Docker or admin permissions",
      "Instant connection presets for Supabase, Neon, AWS RDS, Google Cloud SQL, and Azure Database",
      "High-speed native table editor with virtualized rows, inline cell editing, and JSON drill-down",
      "Safe SQL editor with keyword autocomplete, schema introspection, and automatic EXPLAIN ANALYZE rollback",
      "Interactive visual Entity-Relationship (ER) diagram and schema designer",
      "Foreign key peeking with instant relational navigation",
      "Zero telemetry and 100% privacy with credentials stored in the OS system keychain",
      "Tiny 3MB native installer with instant boot and under 40MB memory usage powered by Rust & Tauri",
    ],
    author: {
      "@type": "Organization",
      name: "PostCompass",
      url: PRODUCT.website,
    },
  };

  const webSiteSchema = {
    "@type": "WebSite",
    "@id": `${PRODUCT.website}#website`,
    url: PRODUCT.website,
    name: PRODUCT.name,
    description: SEO_CONFIG.description,
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      name: "PostCompass",
      url: PRODUCT.website,
      logo: `${PRODUCT.website}/logo.png`,
    },
  };

  const orgSchema = {
    "@type": "Organization",
    "@id": `${PRODUCT.website}#organization`,
    name: "PostCompass",
    url: PRODUCT.website,
    logo: `${PRODUCT.website}/logo.png`,
    sameAs: [PRODUCT.github],
  };

  const faqSchema = {
    "@type": "FAQPage",
    "@id": `${PRODUCT.website}#faq`,
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [softwareAppSchema, webSiteSchema, orgSchema, faqSchema],
  };
}
