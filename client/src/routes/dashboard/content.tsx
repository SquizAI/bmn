import { useState } from 'react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { ContentGenerator } from '@/components/dashboard/content-generator';
import { ContentCalendar } from '@/components/dashboard/content-calendar';
import { useBrands } from '@/hooks/use-brands';
import { apiClient } from '@/lib/api';

interface GeneratedContent {
  id: string;
  platform: string;
  contentType: string;
  caption: string;
  hashtags: string[];
  imagePrompt?: string;
  scheduledFor: string | null;
  createdAt: string;
}

/**
 * AI Content Generation page.
 * Generates social media content using brand voice and identity.
 */
export default function ContentPage() {
  const { data: brands } = useBrands();
  const brandsList = brands?.items || [];
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');

  // Auto-select first brand
  const activeBrandId = selectedBrandId || brandsList[0]?.id || '';

  // Fetch previously generated content for the calendar
  const { data: generatedContent } = useQuery({
    queryKey: ['generated-content', activeBrandId],
    queryFn: () =>
      apiClient.get<{ items: GeneratedContent[] }>('/api/v1/dashboard/content', {
        params: { brandId: activeBrandId, limit: 50 },
      }),
    enabled: !!activeBrandId,
  });

  if (brandsList.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-20"
      >
        <Sparkles className="mb-4 h-12 w-12 text-text-muted" />
        <h2 className="text-lg font-semibold text-text">No brands yet</h2>
        <p className="mt-1 text-[13px] text-text-muted">
          Create a brand first to start generating content.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">
            Content Generation
          </h1>
          <p className="mt-0.5 text-[13px] text-text-muted">
            AI-powered social media content using your brand voice.
          </p>
        </div>

        {/* Brand selector */}
        {brandsList.length > 1 && (
          <select
            value={activeBrandId}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-text focus:border-border-focus focus:outline-none"
          >
            {brandsList.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Content Calendar */}
      <ContentCalendar items={generatedContent?.items || []} />

      {/* Content Generator */}
      <ContentGenerator brandId={activeBrandId} />
    </motion.div>
  );
}
