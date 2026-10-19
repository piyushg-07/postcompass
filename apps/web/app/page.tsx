import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import AwsDbShowcase from "./components/AwsDbShowcase";
import TrustSection from "./components/TrustSection";
import FeaturesSection from "./components/FeaturesSection";
import InteractiveDemo from "./components/InteractiveDemo";
import HowItWorks from "./components/HowItWorks";
import UseCasesSection from "./components/UseCasesSection";
import ComparisonSection from "./components/ComparisonSection";
import DownloadSection from "./components/DownloadSection";
import FaqSection from "./components/FaqSection";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main id="main-content">
        <Hero />
        <AwsDbShowcase />
        <TrustSection />
        <FeaturesSection />
        <InteractiveDemo />
        <HowItWorks />
        <UseCasesSection />
        <ComparisonSection />
        <DownloadSection />
        <FaqSection />
      </main>
      <Footer />
    </>
  );
}
