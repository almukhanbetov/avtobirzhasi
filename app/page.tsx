import { Hero } from "@/components/home/Hero";
import { QuickSearch } from "@/components/home/QuickSearch";
import { BuyingWays } from "@/components/home/BuyingWays";
import { FreshListings } from "@/components/home/FreshListings";
import { ExchangeExplainer } from "@/components/home/ExchangeExplainer";
import { WhyUs } from "@/components/home/WhyUs";
import { TrustSection } from "@/components/home/TrustSection";
import { FinalCta } from "@/components/home/FinalCta";

export default function Home() {
  return (
    <>
      <Hero />
      <QuickSearch />
      <BuyingWays />
      <FreshListings />
      <ExchangeExplainer />
      <WhyUs />
      <TrustSection />
      <FinalCta />
    </>
  );
}
