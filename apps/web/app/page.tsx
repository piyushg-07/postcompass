import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import CloudDbShowcase from "./components/CloudDbShowcase";
import WaitlistSection from "./components/WaitlistSection";
import FeaturesSection from "./components/FeaturesSection";
import InteractiveDemo from "./components/InteractiveDemo";
import HowItWorks from "./components/HowItWorks";
import ComparisonSection from "./components/ComparisonSection";
import DownloadSection from "./components/DownloadSection";
import FaqSection from "./components/FaqSection";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Hero />
        <CloudDbShowcase />
        <WaitlistSection />
        <FeaturesSection />
        <InteractiveDemo />
        <HowItWorks />
        <ComparisonSection />
        <DownloadSection />
        <FaqSection />
      </main>
      <Footer />
    </>
  );
}
