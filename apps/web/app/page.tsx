import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import FeaturesSection from "./components/FeaturesSection";
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
        <FeaturesSection />
        <HowItWorks />
        <DownloadSection />
        <FaqSection />
      </main>
      <Footer />
    </>
  );
}
