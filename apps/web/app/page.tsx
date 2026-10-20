import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import CloudDbShowcase from "./components/CloudDbShowcase";
import WaitlistSection from "./components/WaitlistSection";
import FeaturesSection from "./components/FeaturesSection";
import InteractiveDemo from "./components/InteractiveDemo";
import HowItWorks from "./components/HowItWorks";
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
        <DownloadSection />
        <FaqSection />
      </main>
      <Footer />
    </>
  );
}
