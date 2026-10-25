import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import DownloadSection from "@/components/sections/DownloadSection";
import Footer from "@/components/layout/Footer";
import { PRODUCT, getDownloads } from "@/config/product";
import { getLatestRelease } from "@/lib/release";

export const metadata: Metadata = {
  title: "Download PostCompass — Free PostgreSQL GUI & Client for Windows, macOS, Linux",
  description:
    "Download PostCompass for Windows (.exe, .msi), macOS (Apple Silicon, Intel), or Linux (.AppImage, .deb, .rpm). Free, open source, and lightweight native PostgreSQL desktop app.",
  alternates: {
    canonical: "/download",
  },
  openGraph: {
    title: "Download PostCompass — Native PostgreSQL Desktop Client",
    description:
      "Install PostCompass for Windows, macOS, or Linux. 1-click local Postgres database, cloud connections, visual table editor, and SQL query tool.",
    url: `${PRODUCT.website}/download`,
    type: "website",
    // Setting openGraph here replaces the site-wide one, so the share image is listed again
    images: ["/opengraph-image"],
  },
};

export default async function DownloadPage() {
  const downloads = getDownloads(await getLatestRelease());
  return (
    <>
      <Navbar />
      <main id="main-content">
        <DownloadSection asPage downloads={downloads} />
      </main>
      <Footer />
    </>
  );
}
