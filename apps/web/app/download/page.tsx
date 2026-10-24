import type { Metadata } from "next";
import Navbar from "../components/Navbar";
import DownloadSection from "../components/DownloadSection";
import Footer from "../components/Footer";
import { getDownloads } from "../config/product";
import { getLatestRelease } from "../config/release";

export const metadata: Metadata = {
  title: "Download PostCompass",
  description: "Download PostCompass for Windows, macOS or Linux. Free and open source.",
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
