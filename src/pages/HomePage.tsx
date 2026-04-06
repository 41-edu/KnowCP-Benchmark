import { BenchmarkPerformanceSection } from "../components/BenchmarkPerformanceSection";
import { DataDistributionSection } from "../components/DataDistributionSection";
import { HeroSection } from "../components/HeroSection";
import { IntroSection } from "../components/IntroSection";
import { QuestionDistributionSection } from "../components/QuestionDistributionSection";

export function HomePage() {
  return (
    <main className="page-wrap">
      <HeroSection />
      <IntroSection />
      <DataDistributionSection />
      <QuestionDistributionSection />
      <BenchmarkPerformanceSection />
    </main>
  );
}
