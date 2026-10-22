import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import FeaturesSection from "./components/FeaturesSection";
import CompareSection from "./components/CompareSection";
import HowItWorks from "./components/HowItWorks";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Hero />
        <FeaturesSection />
        <CompareSection />
        <HowItWorks />
      </main>
    </>
  );
}
