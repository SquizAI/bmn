import { useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useStorefrontStore } from '@/stores/storefront-store';
import { useUpdateSection } from '@/hooks/use-storefront';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaleInVariants } from '@/lib/animations';
import { Sparkle } from '@/components/animations/Sparkle';
import {
  Layers, Image, Shield, Type, Grid3X3, ListOrdered, Search,
  Puzzle, Award, MessageSquareQuote, HelpCircle, User, Mail,
  ShoppingBag, Code, Package, Save,
} from 'lucide-react';

const SECTION_ICONS: Record<string, typeof Image> = {
  'hero': Image, 'trust-bar': Shield, 'welcome': Type, 'bundle-grid': Grid3X3,
  'steps': ListOrdered, 'stack-finder': Search, 'bundle-detail': Package,
  'why-bundles': Puzzle, 'quality': Award, 'testimonials': MessageSquareQuote,
  'faq': HelpCircle, 'about': User, 'contact': Mail, 'products': ShoppingBag,
  'custom-html': Code,
};

const SECTION_COLORS: Record<string, { bg: string; text: string }> = {
  'hero': { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  'trust-bar': { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  'welcome': { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  'bundle-grid': { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  'steps': { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  'stack-finder': { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  'bundle-detail': { bg: 'bg-violet-500/15', text: 'text-violet-400' },
  'why-bundles': { bg: 'bg-pink-500/15', text: 'text-pink-400' },
  'quality': { bg: 'bg-teal-500/15', text: 'text-teal-400' },
  'testimonials': { bg: 'bg-sky-500/15', text: 'text-sky-400' },
  'faq': { bg: 'bg-indigo-500/15', text: 'text-indigo-400' },
  'about': { bg: 'bg-rose-500/15', text: 'text-rose-400' },
  'contact': { bg: 'bg-lime-500/15', text: 'text-lime-400' },
  'products': { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400' },
  'custom-html': { bg: 'bg-zinc-500/15', text: 'text-zinc-400' },
};

const DEFAULT_COLOR = { bg: 'bg-zinc-500/15', text: 'text-zinc-400' };

export function SectionEditor() {
  const { storefront, sections, selectedSectionId, updateSectionContent } = useStorefrontStore();
  const updateMutation = useUpdateSection();

  const section = useMemo(
    () => sections.find((s) => s.id === selectedSectionId),
    [sections, selectedSectionId],
  );

  if (!section) {
    return (
      <motion.div
        className="h-full flex flex-col items-center justify-center"
        variants={scaleInVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="relative">
          <div className="bg-linear-to-br from-accent/10 via-surface-elevated to-accent/5 rounded-3xl p-8 shadow-inner border border-border/20">
            <Layers className="h-16 w-16 text-text-muted" />
          </div>
          <Sparkle className="absolute -top-2 -right-2" />
        </div>
        <h3 className="text-lg font-semibold text-text mt-6">Design Your Storefront</h3>
        <p className="text-sm text-text-muted mt-2 max-w-xs text-center">
          Select a section from the sidebar to start customizing your store's look and content.
        </p>
      </motion.div>
    );
  }

  const Icon = SECTION_ICONS[section.sectionType] || Code;
  const color = SECTION_COLORS[section.sectionType] || DEFAULT_COLOR;
  const label = section.sectionType.replace(/-/g, ' ');

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={section.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2 }}
      >
        {/* Editor Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', color.bg)}>
              <Icon className={cn('h-5 w-5', color.text)} />
            </div>
            <div>
              <h2 className="text-lg font-semibold capitalize text-text">{label} Section</h2>
              <p className="text-xs text-text-muted">Changes auto-save after 1 second</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-text-muted">
            <Save className="h-3.5 w-3.5" />
            <span className="text-xs">Auto-save</span>
          </div>
        </div>

        <SectionForm
          key={section.id}
          section={section}
          storefrontId={storefront?.id || ''}
          onUpdate={(content) => {
            updateSectionContent(section.id, content);
            if (storefront) {
              updateMutation.mutate({
                storefrontId: storefront.id,
                sectionId: section.id,
                content: { ...section.content, ...content },
              });
            }
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

function SectionForm({
  section,
  onUpdate,
}: {
  section: { id: string; sectionType: string; content: Record<string, unknown> };
  storefrontId: string;
  onUpdate: (content: Record<string, unknown>) => void;
}) {
  const { register, handleSubmit } = useForm({
    defaultValues: section.content as Record<string, string>,
  });

  const saveTimeout = useMemo(() => ({ current: null as ReturnType<typeof setTimeout> | null }), []);

  const onFieldChange = useCallback(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      handleSubmit((data) => onUpdate(data))();
    }, 1000);
  }, [handleSubmit, onUpdate, saveTimeout]);

  useEffect(() => {
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
  }, [saveTimeout]);

  const type = section.sectionType;

  if (type === 'hero') {
    return (
      <form className="space-y-5" onChange={onFieldChange}>
        <FieldGroup label="Content">
          <Field label="Headline" {...register('headline')} />
          <Field label="Subheadline" {...register('subheadline')} />
        </FieldGroup>
        <FieldGroup label="Call to Action">
          <div className="grid grid-cols-2 gap-3">
            <Field label="CTA Text" {...register('ctaText')} />
            <Field label="CTA Link" {...register('ctaUrl')} />
          </div>
        </FieldGroup>
        <FieldGroup label="Background">
          <Field label="Background Image URL" {...register('backgroundImageUrl')} />
          <div>
            <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">Overlay Opacity</label>
            <input
              type="range" min="0" max="1" step="0.1"
              {...register('overlayOpacity')}
              onChange={(e) => { register('overlayOpacity').onChange(e); onFieldChange(); }}
              className="w-full mt-1 accent-[#D4A574]"
            />
          </div>
        </FieldGroup>
      </form>
    );
  }

  if (type === 'welcome' || type === 'about') {
    return (
      <form className="space-y-5" onChange={onFieldChange}>
        <FieldGroup label="Content">
          <Field label="Title" {...register('title')} />
          {type === 'about' && <Field label="Subtitle" {...register('subtitle')} />}
          <TextareaField label="Body" {...register('body')} rows={6} />
        </FieldGroup>
        <FieldGroup label="Media">
          <Field label="Image URL" {...register('imageUrl')} />
        </FieldGroup>
        {type === 'about' && (
          <FieldGroup label="Call to Action">
            <div className="grid grid-cols-2 gap-3">
              <Field label="CTA Text" {...register('ctaText')} />
              <Field label="CTA Link" {...register('ctaUrl')} />
            </div>
          </FieldGroup>
        )}
      </form>
    );
  }

  if (type === 'quality') {
    return (
      <form className="space-y-5" onChange={onFieldChange}>
        <FieldGroup label="Content">
          <Field label="Title" {...register('title')} />
          <TextareaField label="Body" {...register('body')} rows={4} />
        </FieldGroup>
        <FieldGroup label="Media">
          <Field label="Image URL" {...register('imageUrl')} />
        </FieldGroup>
      </form>
    );
  }

  if (type === 'steps') {
    return (
      <form className="space-y-5" onChange={onFieldChange}>
        <FieldGroup label="Content">
          <Field label="Title" {...register('title')} />
          <Field label="Subtitle" {...register('subtitle')} />
        </FieldGroup>
        <div className="rounded-xl border border-border/30 bg-surface-elevated/30 p-4">
          <p className="text-sm text-text-muted">
            Steps are auto-populated from your brand data. Edit the JSON directly for advanced customization.
          </p>
        </div>
      </form>
    );
  }

  if (type === 'contact') {
    return (
      <form className="space-y-5" onChange={onFieldChange}>
        <FieldGroup label="Content">
          <Field label="Title" {...register('title')} />
          <Field label="Subtitle" {...register('subtitle')} />
        </FieldGroup>
      </form>
    );
  }

  if (type === 'bundle-grid' || type === 'products') {
    return (
      <form className="space-y-5" onChange={onFieldChange}>
        <FieldGroup label="Display Settings">
          <Field label="Title" {...register('title')} />
          <Field label="Max Items" {...register('maxItems')} type="number" />
        </FieldGroup>
      </form>
    );
  }

  if (type === 'testimonials' || type === 'faq') {
    return (
      <form className="space-y-5" onChange={onFieldChange}>
        <FieldGroup label="Content">
          <Field label="Section Title" {...register('title')} />
        </FieldGroup>
        <div className="rounded-xl border border-accent/20 bg-accent-light p-4">
          <p className="text-sm text-text-secondary">
            Manage {type === 'testimonials' ? 'testimonials' : 'FAQs'} from the dedicated tab above.
          </p>
        </div>
      </form>
    );
  }

  return (
    <form className="space-y-5" onChange={onFieldChange}>
      <FieldGroup label="Content">
        <Field label="Title" {...register('title')} />
      </FieldGroup>
      <div className="rounded-xl border border-border/30 bg-surface-elevated/30 p-4">
        <p className="text-sm text-text-muted">
          This section type uses auto-populated content from your brand data.
        </p>
      </div>
    </form>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/30 bg-surface-elevated/30 p-4 space-y-3">
      <p className="text-[13px] font-medium text-text-secondary uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">{label}</label>
      <Input
        className="bg-surface border-border/50 rounded-lg px-4 py-3 text-sm placeholder:text-text-muted hover:border-border-hover focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-colors"
        {...props}
      />
    </div>
  );
}

function TextareaField({ label, rows = 4, ...props }: { label: string; rows?: number } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">{label}</label>
      <textarea
        rows={rows}
        className="w-full bg-surface border border-border/50 rounded-lg px-4 py-3 text-sm placeholder:text-text-muted hover:border-border-hover focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none transition-colors"
        {...props}
      />
    </div>
  );
}
