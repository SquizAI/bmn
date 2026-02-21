import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Instagram,
  Music2,
  Twitter,
  Globe,
  Sparkles,
  Copy,
  Check,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useUIStore } from '@/stores/ui-store';

// ------ Types ------

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

interface GenerateRequest {
  brandId: string;
  platform: string;
  contentType: string;
  topic?: string;
  tone: string;
}

// ------ Constants ------

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: <Instagram className="h-4 w-4" /> },
  { id: 'tiktok', label: 'TikTok', icon: <Music2 className="h-4 w-4" /> },
  { id: 'twitter', label: 'X / Twitter', icon: <Twitter className="h-4 w-4" /> },
  { id: 'general', label: 'General', icon: <Globe className="h-4 w-4" /> },
];

const CONTENT_TYPES: Record<string, Array<{ id: string; label: string }>> = {
  instagram: [
    { id: 'post', label: 'Post Caption' },
    { id: 'story', label: 'Story' },
    { id: 'reel_script', label: 'Reel Script' },
  ],
  tiktok: [
    { id: 'post', label: 'Caption' },
    { id: 'reel_script', label: 'Video Script' },
  ],
  twitter: [
    { id: 'post', label: 'Tweet' },
  ],
  general: [
    { id: 'announcement', label: 'Announcement' },
    { id: 'promotional', label: 'Promotional' },
  ],
};

const TONES = [
  { id: 'casual', label: 'Casual' },
  { id: 'professional', label: 'Professional' },
  { id: 'playful', label: 'Playful' },
  { id: 'bold', label: 'Bold' },
  { id: 'inspirational', label: 'Inspirational' },
];

// ------ Component ------

interface ContentGeneratorProps {
  brandId: string;
  className?: string;
}

function ContentGenerator({ brandId, className }: ContentGeneratorProps) {
  const [platform, setPlatform] = useState('instagram');
  const [contentType, setContentType] = useState('post');
  const [tone, setTone] = useState('casual');
  const [topic, setTopic] = useState('');
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [copied, setCopied] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  const generateMutation = useMutation({
    mutationFn: (data: GenerateRequest) =>
      apiClient.post<GeneratedContent>('/api/v1/dashboard/content/generate', data),
    onSuccess: (data) => {
      setGenerated(data);
      addToast({ type: 'success', title: 'Content generated!' });
    },
    onError: () => {
      addToast({ type: 'error', title: 'Failed to generate content' });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      brandId,
      platform,
      contentType,
      topic: topic || undefined,
      tone,
    });
  };

  const handleCopy = async () => {
    if (!generated) return;
    const text = `${generated.caption}\n\n${generated.hashtags.map((h) => `#${h}`).join(' ')}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlatformChange = (id: string) => {
    setPlatform(id);
    const types = CONTENT_TYPES[id];
    if (types && types.length > 0) {
      setContentType(types[0].id);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Platform Selection */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          Platform
        </p>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePlatformChange(p.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-all',
                platform === p.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-text-secondary hover:border-border-hover hover:bg-surface-hover',
              )}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Type */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          Content Type
        </p>
        <div className="flex flex-wrap gap-2">
          {(CONTENT_TYPES[platform] || []).map((ct) => (
            <button
              key={ct.id}
              type="button"
              onClick={() => setContentType(ct.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all',
                contentType === ct.id
                  ? 'border-accent bg-accent-light text-accent'
                  : 'border-border text-text-secondary hover:border-border-hover',
              )}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tone */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          Tone
        </p>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTone(t.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all',
                tone === t.id
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-border text-text-secondary hover:border-border-hover',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Topic */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          Topic (optional)
        </p>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What should this content be about? e.g., New product launch, seasonal sale, behind-the-scenes..."
          className="w-full rounded-lg border border-border bg-surface p-3 text-[13px] text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none"
          rows={2}
        />
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        loading={generateMutation.isPending}
        leftIcon={<Sparkles className="h-4 w-4" />}
        className="self-start"
      >
        Generate Content
      </Button>

      {/* Generated Content Preview */}
      <AnimatePresence>
        {generated && (
          <GeneratedPost content={generated} onCopy={handleCopy} copied={copied} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ------ Generated Post Preview ------

interface GeneratedPostProps {
  content: GeneratedContent;
  onCopy: () => void;
  copied: boolean;
}

function GeneratedPost({ content, onCopy, copied }: GeneratedPostProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <Card variant="outlined" padding="md">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="text-[13px]">Generated Content</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            leftIcon={
              copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )
            }
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>

        <div className="rounded-lg bg-surface-hover p-4">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text">
            {content.caption}
          </p>

          {content.hashtags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {content.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 rounded-full bg-info-bg px-2 py-0.5 text-xs font-medium text-info"
                >
                  <Hash className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {content.imagePrompt && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-text-muted">
              Image Prompt
            </p>
            <p className="text-[12px] italic text-text-secondary">
              {content.imagePrompt}
            </p>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

// ------ Content Type Selector (exported separately) ------

interface ContentTypeSelectorProps {
  platform: string;
  selected: string;
  onChange: (type: string) => void;
}

function ContentTypeSelector({ platform, selected, onChange }: ContentTypeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {(CONTENT_TYPES[platform] || []).map((ct) => (
        <button
          key={ct.id}
          type="button"
          onClick={() => onChange(ct.id)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all',
            selected === ct.id
              ? 'border-accent bg-accent-light text-accent'
              : 'border-border text-text-secondary hover:border-border-hover',
          )}
        >
          {ct.label}
        </button>
      ))}
    </div>
  );
}

export { ContentGenerator, ContentTypeSelector };
