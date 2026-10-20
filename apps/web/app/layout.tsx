import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { PRODUCT } from "./config/product";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
});

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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
