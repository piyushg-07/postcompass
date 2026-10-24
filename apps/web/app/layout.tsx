import type { Metadata, Viewport } from "next";
import { Geist, Fraunces, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { PRODUCT } from "@/config/product";
import { SEO_CONFIG, getJsonLdStructuredData } from "@/config/seo";
import ScrollReveal from "@/components/layout/ScrollReveal";

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
  authors: [...SEO_CONFIG.authors],
  creator: SEO_CONFIG.creator,
  publisher: SEO_CONFIG.publisher,
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "128x128", type: "image/png" },
      { url: "/logo.png", sizes: "128x128", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "128x128", type: "image/png" },
      { url: "/logo.png", sizes: "128x128", type: "image/png" },
    ],
    shortcut: "/logo.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SEO_CONFIG.canonicalUrl,
    siteName: SEO_CONFIG.siteName,
    title: SEO_CONFIG.titleDefault,
    description: SEO_CONFIG.description,
    images: [
      {
        url: SEO_CONFIG.ogImage.url,
        width: SEO_CONFIG.ogImage.width,
        height: SEO_CONFIG.ogImage.height,
        alt: SEO_CONFIG.ogImage.alt,
        type: SEO_CONFIG.ogImage.type,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_CONFIG.titleDefault,
    description: SEO_CONFIG.description,
    creator: SEO_CONFIG.twitterHandle,
    images: [SEO_CONFIG.ogImage.url],
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ScrollReveal />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
