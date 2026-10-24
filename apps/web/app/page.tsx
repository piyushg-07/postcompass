import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import FeaturesSection from "./components/FeaturesSection";
import HowItWorks from "./components/HowItWorks";
import DownloadSection from "./components/DownloadSection";
import FaqSection from "./components/FaqSection";
import Footer from "./components/Footer";
import { getDownloads } from "./config/product";
import { getLatestRelease } from "./config/release";

export default async function Home() {
  const downloads = getDownloads(await getLatestRelease());
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Hero version={downloads.version} />
        <FeaturesSection />
        <HowItWorks />
        <DownloadSection downloads={downloads} />
        <FaqSection />
      </main>
      <Footer />
    </>
  );
}
