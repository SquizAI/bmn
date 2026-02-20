import { Hero } from '@/components/sections/hero';
import { SocialProofCounters } from '@/components/sections/social-proof-counters';
import { HowItWorks } from '@/components/sections/how-it-works';
import { FeatureShowcase } from '@/components/sections/feature-showcase';
import { BeforeAfterTransformer } from '@/components/sections/before-after-transformer';
import { ProductShowcase } from '@/components/sections/product-showcase';
import { RoiCalculator } from '@/components/sections/roi-calculator';
import { Testimonials } from '@/components/sections/testimonials';
import { HomeFaq } from '@/components/sections/home-faq';
import { FinalCta } from '@/components/sections/final-cta';

export default function HomePage() {
  return (
    <>
      <Hero />
      <SocialProofCounters />
      <HowItWorks />
      <FeatureShowcase />
      <BeforeAfterTransformer />
      <ProductShowcase />
      <RoiCalculator />
      <Testimonials />
      <HomeFaq />
      <FinalCta />
    </>
  );
}
