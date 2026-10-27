import { PRODUCT, FAQ_ITEMS, CLOUD_PROVIDERS } from "./product";
import { GUIDES } from "./guides";

/** The maintainer, so search engines and AI assistants can tie the project to a real person. */
export const AUTHOR = {
  name: "Piyush Gupta",
  url: "https://github.com/piyushg-07",
} as const;

export const SEO_CONFIG = {
  siteName: PRODUCT.name,
  titleDefault: `${PRODUCT.name}: Free PostgreSQL GUI & Desktop Client for Windows, macOS and Linux`,
  titleTemplate: `%s | ${PRODUCT.name}`,
  description:
    "PostCompass is a free, open-source PostgreSQL GUI. Run a local PostgreSQL server in one click without Docker, connect to AWS RDS, Cloud SQL, Azure, Neon and more, and browse, edit and query your data in a fast native desktop app.",
  canonicalUrl: PRODUCT.website,
  keywords: [
    "PostgreSQL GUI",
    "Postgres GUI",
    "PostgreSQL client",
    "PostgreSQL desktop app",
    "open source PostgreSQL GUI",
    "free PostgreSQL client",
    "run PostgreSQL locally without Docker",
    "local PostgreSQL",
    "pgAdmin alternative",
    "PostgreSQL table editor",
    "PostgreSQL SQL editor",
    "EXPLAIN ANALYZE visualizer",
    "PostgreSQL ER diagram",
    "AWS RDS PostgreSQL client",
    "Neon PostgreSQL client",
    "PostgreSQL GUI for Mac",
    "PostgreSQL GUI for Windows",
    "PostgreSQL GUI for Linux",
  ],
  themeColor: "#09090b",
} as const;

/** Schema.org data for search engines and AI assistants. Only facts that are true and checkable. */
export function getJsonLdStructuredData() {
  const author = {
    "@type": "Person",
    "@id": `${PRODUCT.website}#author`,
    name: AUTHOR.name,
    url: AUTHOR.url,
    sameAs: [AUTHOR.url],
  };

  // The project as a brand, so "PostCompass" resolves to this site and its GitHub repo, not to "Compass"
  const organization = {
    "@type": "Organization",
    "@id": `${PRODUCT.website}#organization`,
    name: PRODUCT.name,
    alternateName: "Post Compass",
    url: PRODUCT.website,
    logo: {
      "@type": "ImageObject",
      url: `${PRODUCT.website}/logo.png`,
    },
    description: SEO_CONFIG.description,
    founder: { "@id": `${PRODUCT.website}#author` },
    sameAs: [PRODUCT.github],
  };

  const softwareAppSchema = {
    "@type": "SoftwareApplication",
    "@id": `${PRODUCT.website}#software`,
    name: PRODUCT.name,
    alternateName: ["Post Compass", "PostCompass PostgreSQL GUI"],
    sameAs: [PRODUCT.github],
    releaseNotes: `${PRODUCT.github}/releases`,
    softwareHelp: { "@type": "CreativeWork", url: `${PRODUCT.website}/guides` },
    // The guides aren't linked in the page UI, so every page lists them here for search engines and AI assistants
    subjectOf: GUIDES.map((g) => ({
      "@type": "TechArticle",
      headline: g.title,
      description: g.description,
      url: `${PRODUCT.website}/guides/${g.slug}`,
      dateModified: g.updated,
    })),
    operatingSystem: "Windows 10, Windows 11, macOS (Apple Silicon and Intel), Linux (x86_64)",
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "Database client",
    description: SEO_CONFIG.description,
    url: PRODUCT.website,
    downloadUrl: `${PRODUCT.website}/download`,
    softwareVersion: PRODUCT.version,
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
    codeRepository: PRODUCT.github,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    screenshot: [
      `${PRODUCT.website}/screens/table-editor.webp`,
      `${PRODUCT.website}/screens/sql-editor.webp`,
      `${PRODUCT.website}/screens/explain-plan.webp`,
      `${PRODUCT.website}/screens/er-diagram.webp`,
    ],
    featureList: [
      "One-click local PostgreSQL 14 to 18, with checksum-verified binaries and no Docker or admin rights",
      `Connections to ${CLOUD_PROVIDERS.join(", ")} or any PostgreSQL server, with TLS certificate verification`,
      "Detects PostgreSQL already installed or running on the computer",
      "Spreadsheet-style table editor with filters, sorting, CSV import and export, and foreign-key navigation",
      "SQL editor with schema-aware autocomplete, query history and charts",
      "Visual EXPLAIN ANALYZE that highlights the slowest step and runs inside a rolled-back transaction",
      "Interactive ER diagram of tables and relationships",
      "Passwords stored in the operating system keychain; no telemetry",
    ],
    author: { "@id": `${PRODUCT.website}#author` },
    publisher: { "@id": `${PRODUCT.website}#organization` },
  };

  const webSiteSchema = {
    "@type": "WebSite",
    "@id": `${PRODUCT.website}#website`,
    url: PRODUCT.website,
    name: PRODUCT.name,
    alternateName: "Post Compass",
    description: SEO_CONFIG.description,
    inLanguage: "en",
    publisher: { "@id": `${PRODUCT.website}#organization` },
  };

  return {
    "@context": "https://schema.org",
    "@graph": [author, organization, softwareAppSchema, webSiteSchema],
  };
}

/** FAQ structured data. Only on the home page, where the FAQ is actually shown. */
export function getFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${PRODUCT.website}#faq`,
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** JSON-LD as a string that's safe to inline in a <script> tag (no `</script>` breakouts). */
export function toJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
