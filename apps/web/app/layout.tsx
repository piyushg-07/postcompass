import type { Metadata, Viewport } from "next";
import { Geist, Fraunces, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { PRODUCT } from "@/config/product";
import { AUTHOR, SEO_CONFIG, getJsonLdStructuredData, toJsonLd } from "@/config/seo";
import ScrollReveal from "@/components/layout/ScrollReveal";
import DatadogRum from "@/components/layout/DatadogRum";

// The site's fonts, self-hosted and preloaded by next/font so text renders right away without a layout jump
const sans = Geist({ subsets: ["latin"], variable: "--font-sans-loaded", display: "swap" });
const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-display-loaded",
  display: "swap",
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-loaded", display: "swap" });

export const viewport: Viewport = {
  themeColor: SEO_CONFIG.themeColor,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCT.website),
  title: {
    default: SEO_CONFIG.titleDefault,
    template: SEO_CONFIG.titleTemplate,
  },
  description: SEO_CONFIG.description,
  applicationName: PRODUCT.name,
  keywords: [...SEO_CONFIG.keywords],
  authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
  creator: AUTHOR.name,
  publisher: AUTHOR.name,
  alternates: {
    canonical: "/",
    // Plain-text summaries for AI assistants (https://llmstxt.org)
    types: { "text/plain": "/llms.txt" },
  },
  // app/icon.png and app/apple-icon.png are picked up automatically
  manifest: "/manifest.webmanifest",
  // The share image comes from app/opengraph-image.tsx, which Next.js wires up for every page
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SEO_CONFIG.canonicalUrl,
    siteName: SEO_CONFIG.siteName,
    title: SEO_CONFIG.titleDefault,
    description: SEO_CONFIG.description,
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_CONFIG.titleDefault,
    description: SEO_CONFIG.description,
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = getJsonLdStructuredData();

  return (
    <html lang="en" className={`dark ${sans.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ScrollReveal />
        <DatadogRum />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
