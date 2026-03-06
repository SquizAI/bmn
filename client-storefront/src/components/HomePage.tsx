import type { StoreData, Product, StoreSection } from '@/lib/api';

// Section renderers
import { HeroSection } from './sections/HeroSection';
import { TrustBarSection } from './sections/TrustBarSection';
import { WelcomeSection } from './sections/WelcomeSection';
import { BundleGridSection } from './sections/BundleGridSection';
import { StepsSection } from './sections/StepsSection';
import { StackFinderSection } from './sections/StackFinderSection';
import { BundleDetailSection } from './sections/BundleDetailSection';
import { WhyBundlesSection } from './sections/WhyBundlesSection';
import { QualitySection } from './sections/QualitySection';
import { TestimonialsSection } from './sections/TestimonialsSection';
import { FaqSection } from './sections/FaqSection';
import { AboutSection } from './sections/AboutSection';
import { ContactSection } from './sections/ContactSection';
import { ProductsSection } from './sections/ProductsSection';
import { CustomHtmlSection } from './sections/CustomHtmlSection';

interface Props {
  store: StoreData;
  products: Product[];
  filterByCategory: (category: string) => void;
}

export function HomePage({ store, products, filterByCategory }: Props) {
  const { sections, testimonials, faqs } = store;

  // Extract slug for contact form
  const slug = store.storefront.slug;

  // Sort sections by sortOrder
  const sorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      {sorted.map((section) => (
        <SectionRenderer
          key={section.id}
          section={section}
          store={store}
          products={products}
          slug={slug}
          testimonials={testimonials}
          faqs={faqs}
          filterByCategory={filterByCategory}
        />
      ))}
    </>
  );
}

interface SectionRendererProps {
  section: StoreSection;
  store: StoreData;
  products: Product[];
  slug: string;
  testimonials: StoreData['testimonials'];
  faqs: StoreData['faqs'];
  filterByCategory: (category: string) => void;
}

function SectionRenderer({
  section,
  products,
  slug,
  testimonials,
  faqs,
  filterByCategory,
}: SectionRendererProps) {
  switch (section.sectionType) {
    case 'hero':
      return <HeroSection section={section} />;
    case 'trust-bar':
      return <TrustBarSection section={section} />;
    case 'welcome':
      return <WelcomeSection section={section} />;
    case 'bundle-grid':
      return <BundleGridSection section={section} products={products} />;
    case 'steps':
      return <StepsSection section={section} />;
    case 'stack-finder':
      return <StackFinderSection section={section} />;
    case 'bundle-detail':
      return <BundleDetailSection section={section} products={products} />;
    case 'why-bundles':
      return <WhyBundlesSection section={section} />;
    case 'quality':
      return <QualitySection section={section} />;
    case 'testimonials':
      return <TestimonialsSection section={section} testimonials={testimonials} />;
    case 'faq':
      return <FaqSection section={section} faqs={faqs} />;
    case 'about':
      return <AboutSection section={section} />;
    case 'contact':
      return <ContactSection section={section} slug={slug} />;
    case 'products':
      return <ProductsSection section={section} products={products} filterByCategory={filterByCategory} />;
    case 'custom-html':
      return <CustomHtmlSection section={section} />;
    default:
      return null;
  }
}
