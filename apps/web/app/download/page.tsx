import type { Metadata } from "next";
import Navbar from "../components/Navbar";
import DownloadSection from "../components/DownloadSection";
import FaqSection from "../components/FaqSection";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Download PostCompass",
  description: "Download PostCompass for Windows, macOS or Linux. Free and open source.",
};

export default function DownloadPage() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <DownloadSection asPage />
        <FaqSection />
      </main>
      <Footer />
    </>
  );
}
