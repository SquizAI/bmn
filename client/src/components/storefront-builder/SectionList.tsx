import { useCallback, useRef } from 'react';
import { useStorefrontStore, type StorefrontSection } from '@/stores/storefront-store';
import { useReorderSections, useUpdateSection, useDeleteSection } from '@/hooks/use-storefront';
import { Button } from '@/components/ui/button';
import {
  GripVertical, Eye, EyeOff, Trash2, Plus,
  Image, Shield, Type, Grid3X3, ListOrdered, Search,
  Puzzle, Award, MessageSquareQuote, HelpCircle,
  User, Mail, ShoppingBag, Code,
} from 'lucide-react';

const SECTION_ICONS: Record<string, typeof Image> = {
  'hero': Image,
  'trust-bar': Shield,
  'welcome': Type,
  'bundle-grid': Grid3X3,
  'steps': ListOrdered,
  'stack-finder': Search,
  'why-bundles': Puzzle,
  'quality': Award,
  'testimonials': MessageSquareQuote,
  'faq': HelpCircle,
  'about': User,
  'contact': Mail,
  'products': ShoppingBag,
  'custom-html': Code,
};

const SECTION_LABELS: Record<string, string> = {
  'hero': 'Hero Banner',
  'trust-bar': 'Trust Bar',
  'welcome': 'Welcome',
  'bundle-grid': 'Bundle Grid',
  'steps': 'Steps',
  'stack-finder': 'Stack Finder',
  'bundle-detail': 'Bundle Detail',
  'why-bundles': 'Why Bundles',
  'quality': 'Quality',
  'testimonials': 'Testimonials',
  'faq': 'FAQs',
  'about': 'About Us',
  'contact': 'Contact',
  'products': 'Products',
  'custom-html': 'Custom HTML',
};

export function SectionList() {
  const {
    storefront, sections, selectedSectionId, selectSection,
    toggleSectionVisibility, reorderSections: reorderLocal,
  } = useStorefrontStore();

  const reorderMutation = useReorderSections();
  const updateMutation = useUpdateSection();
  const deleteMutation = useDeleteSection();
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index;
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    dragOverItem.current = index;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const from = dragItem.current;
    const to = dragOverItem.current;
    reorderLocal(from, to);

    // Persist to server
    const reordered = [...sections];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    if (storefront) {
      reorderMutation.mutate({
        storefrontId: storefront.id,
        sectionIds: reordered.map((s) => s.id),
      });
    }

    dragItem.current = null;
    dragOverItem.current = null;
  }, [sections, storefront, reorderLocal, reorderMutation]);

  const handleToggleVisibility = (section: StorefrontSection) => {
    toggleSectionVisibility(section.id);
    if (storefront) {
      updateMutation.mutate({
        storefrontId: storefront.id,
        sectionId: section.id,
        isVisible: !section.isVisible,
      });
    }
  };

  const handleDelete = (section: StorefrontSection) => {
    if (!storefront) return;
    if (!confirm(`Delete "${SECTION_LABELS[section.sectionType] || section.sectionType}" section?`)) return;
    deleteMutation.mutate({ storefrontId: storefront.id, sectionId: section.id });
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Sections
        </h3>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1">
        {sections.map((section, index) => {
          const Icon = SECTION_ICONS[section.sectionType] || Code;
          const label = SECTION_LABELS[section.sectionType] || section.sectionType;
          const isSelected = selectedSectionId === section.id;

          return (
            <div
              key={section.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => selectSection(section.id)}
              className={`
                group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors
                ${isSelected
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'hover:bg-muted border border-transparent'
                }
                ${!section.isVisible ? 'opacity-50' : ''}
              `}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium truncate flex-1">{label}</span>

              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleVisibility(section); }}
                  className="p-1 rounded hover:bg-muted-foreground/10"
                  title={section.isVisible ? 'Hide section' : 'Show section'}
                >
                  {section.isVisible
                    ? <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(section); }}
                  className="p-1 rounded hover:bg-destructive/10"
                  title="Delete section"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
