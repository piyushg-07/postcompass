import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PRODUCT } from "./config/product";
import ScrollReveal from "./components/ScrollReveal";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  display: "swap",
  preload: false,
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

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

export const metadata: Metadata = {
  title: `${PRODUCT.name} — ${PRODUCT.tagline}`,
  description: PRODUCT.description,
  keywords: [
    "PostgreSQL",
    "Postgres GUI",
    "Database Client",
    "Supabase Table Editor",
    "pgAdmin alternative",
    "Data Editor",
    "SQL Client",
    "Schema Designer",
  ],
  authors: [{ name: "PostCompass Team" }],
  openGraph: {
    title: `${PRODUCT.name} — ${PRODUCT.tagline}`,
    description: PRODUCT.description,
    url: PRODUCT.website,
    siteName: PRODUCT.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${PRODUCT.name} — ${PRODUCT.tagline}`,
    description: PRODUCT.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
        {children}
        <ScrollReveal />
      </body>
    </html>
  );
}
