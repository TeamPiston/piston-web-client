import { Header } from "@/widgets/header";
import {
  CTASection,
  FeatureSection,
  FooterSection,
  HeroSection,
  ProcessSection,
} from "./components";

export default function Home() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#fbfbfb] text-[#171717]">
      <Header />
      <main>
        <HeroSection />
        <FeatureSection />
        <ProcessSection />
        <CTASection />
      </main>
      <FooterSection />
    </div>
  );
}
