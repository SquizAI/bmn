import { useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useStorefrontStore } from '@/stores/storefront-store';
import { useUpdateSection } from '@/hooks/use-storefront';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Layers } from 'lucide-react';

export function SectionEditor() {
  const { storefront, sections, selectedSectionId, updateSectionContent } = useStorefrontStore();
  const updateMutation = useUpdateSection();

  const section = useMemo(
    () => sections.find((s) => s.id === selectedSectionId),
    [sections, selectedSectionId],
  );

  if (!section) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <Layers className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">Select a section to edit</p>
        <p className="text-sm">Click a section in the sidebar to begin editing.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 capitalize">
        {section.sectionType.replace(/-/g, ' ')} Section
      </h2>
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
    </div>
  );
}

function SectionForm({
  section,
  storefrontId,
  onUpdate,
}: {
  section: { id: string; sectionType: string; content: Record<string, unknown> };
  storefrontId: string;
  onUpdate: (content: Record<string, unknown>) => void;
}) {
  const { register, handleSubmit, watch } = useForm({
    defaultValues: section.content as Record<string, string>,
  });

  // Debounced auto-save
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

  // Render fields based on section type
  if (type === 'hero') {
    return (
      <form className="space-y-4" onChange={onFieldChange}>
        <Field label="Headline" {...register('headline')} />
        <Field label="Subheadline" {...register('subheadline')} />
        <Field label="CTA Text" {...register('ctaText')} />
        <Field label="CTA Link" {...register('ctaUrl')} />
        <Field label="Background Image URL" {...register('backgroundImageUrl')} />
        <div>
          <label className="text-sm font-medium">Overlay Opacity</label>
          <input
            type="range" min="0" max="1" step="0.1"
            {...register('overlayOpacity')}
            onChange={(e) => { register('overlayOpacity').onChange(e); onFieldChange(); }}
            className="w-full mt-1"
          />
        </div>
      </form>
    );
  }

  if (type === 'welcome' || type === 'about') {
    return (
      <form className="space-y-4" onChange={onFieldChange}>
        <Field label="Title" {...register('title')} />
        {type === 'about' && <Field label="Subtitle" {...register('subtitle')} />}
        <div>
          <label className="text-sm font-medium">Body</label>
          <textarea
            {...register('body')}
            rows={6}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <Field label="Image URL" {...register('imageUrl')} />
        {type === 'about' && (
          <>
            <Field label="CTA Text" {...register('ctaText')} />
            <Field label="CTA Link" {...register('ctaUrl')} />
          </>
        )}
      </form>
    );
  }

  if (type === 'quality') {
    return (
      <form className="space-y-4" onChange={onFieldChange}>
        <Field label="Title" {...register('title')} />
        <div>
          <label className="text-sm font-medium">Body</label>
          <textarea
            {...register('body')}
            rows={4}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <Field label="Image URL" {...register('imageUrl')} />
      </form>
    );
  }

  if (type === 'steps') {
    return (
      <form className="space-y-4" onChange={onFieldChange}>
        <Field label="Title" {...register('title')} />
        <Field label="Subtitle" {...register('subtitle')} />
        <p className="text-sm text-muted-foreground">
          Steps are auto-populated. Edit the JSON directly for advanced customization.
        </p>
      </form>
    );
  }

  if (type === 'contact') {
    return (
      <form className="space-y-4" onChange={onFieldChange}>
        <Field label="Title" {...register('title')} />
        <Field label="Subtitle" {...register('subtitle')} />
      </form>
    );
  }

  if (type === 'bundle-grid' || type === 'products') {
    return (
      <form className="space-y-4" onChange={onFieldChange}>
        <Field label="Title" {...register('title')} />
        <Field label="Max Items" {...register('maxItems')} type="number" />
      </form>
    );
  }

  if (type === 'testimonials' || type === 'faq') {
    return (
      <form className="space-y-4" onChange={onFieldChange}>
        <Field label="Section Title" {...register('title')} />
        <p className="text-sm text-muted-foreground">
          Manage {type === 'testimonials' ? 'testimonials' : 'FAQs'} from the dedicated tab above.
        </p>
      </form>
    );
  }

  // Generic fallback
  return (
    <form className="space-y-4" onChange={onFieldChange}>
      <Field label="Title" {...register('title')} />
      <p className="text-sm text-muted-foreground">
        This section type uses auto-populated content from your brand data.
      </p>
    </form>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <Input className="mt-1" {...props} />
    </div>
  );
}
