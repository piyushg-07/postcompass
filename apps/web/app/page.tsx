import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/sections/Hero";
import FeaturesSection from "@/components/sections/FeaturesSection";
import HowItWorks from "@/components/sections/HowItWorks";
import DownloadSection from "@/components/sections/DownloadSection";
import FaqSection from "@/components/sections/FaqSection";
import Footer from "@/components/layout/Footer";
import { getDownloads } from "@/config/product";
import { getFaqJsonLd, toJsonLd } from "@/config/seo";
import { getLatestRelease } from "@/lib/release";

export default async function Home() {
  const downloads = getDownloads(await getLatestRelease());
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(getFaqJsonLd()) }} />
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
