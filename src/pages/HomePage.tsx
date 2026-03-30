import { BenchmarkPerformanceSection } from "../components/BenchmarkPerformanceSection";
import { DataDistributionSection } from "../components/DataDistributionSection";
import { HeroSection } from "../components/HeroSection";
import { PanoramaEntrySection } from "../components/PanoramaEntrySection";
import { QuestionDistributionSection } from "../components/QuestionDistributionSection";

export function HomePage() {
  return (
    <main className="page-wrap">
      <HeroSection />
      <DataDistributionSection />
      <PanoramaEntrySection />
      <QuestionDistributionSection />
      <BenchmarkPerformanceSection />
    </main>
  );
}
