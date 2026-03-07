import { useCallback, useRef, useState } from 'react';
import { useStorefrontStore, type StorefrontSection } from '@/stores/storefront-store';
import { useReorderSections, useUpdateSection, useDeleteSection } from '@/hooks/use-storefront';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { staggerContainerVariants, fadeSlideUpVariants } from '@/lib/animations';
import {
  Eye, EyeOff, Trash2, Plus, ChevronUp, ChevronDown,
  Image, Shield, Type, Grid3X3, ListOrdered, Search,
  Puzzle, Award, MessageSquareQuote, HelpCircle,
  User, Mail, ShoppingBag, Code, Package,
} from 'lucide-react';

const SECTION_ICONS: Record<string, typeof Image> = {
  'hero': Image,
  'trust-bar': Shield,
  'welcome': Type,
  'bundle-grid': Grid3X3,
  'steps': ListOrdered,
  'stack-finder': Search,
  'bundle-detail': Package,
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

const SECTION_SUBTITLES: Record<string, string> = {
  'hero': 'Main headline + CTA',
  'trust-bar': 'Social proof badges',
  'welcome': 'Brand introduction',
  'bundle-grid': 'Product bundles',
  'steps': 'How it works',
  'stack-finder': 'Interactive quiz',
  'bundle-detail': 'Product spotlight',
  'why-bundles': 'Value propositions',
  'quality': 'Trust & quality',
  'testimonials': 'Customer quotes',
  'faq': 'Common questions',
  'about': 'Your story',
  'contact': 'Get in touch',
  'products': 'Product catalog',
  'custom-html': 'Custom content',
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
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index;
    setDraggingIndex(index);
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    dragOverItem.current = index;
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      setDraggingIndex(null);
      setDragOverIndex(null);
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const from = dragItem.current;
    const to = dragOverItem.current;
    reorderLocal(from, to);

    const reordered = [...sections];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    if (storefront) {
      reorderMutation.mutate({
        storefrontId: storefront.id,
        sectionIds: reordered.map((s) => s.id),
      });
    }

    setDraggingIndex(null);
    setDragOverIndex(null);
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

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    reorderLocal(index, index - 1);
    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(index - 1, 0, moved);
    if (storefront) {
      reorderMutation.mutate({
        storefrontId: storefront.id,
        sectionIds: reordered.map((s) => s.id),
      });
    }
  };

  const handleMoveDown = (index: number) => {
    if (index >= sections.length - 1) return;
    reorderLocal(index, index + 1);
    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(index + 1, 0, moved);
    if (storefront) {
      reorderMutation.mutate({
        storefrontId: storefront.id,
        sectionIds: reordered.map((s) => s.id),
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-secondary">
              Sections
            </h3>
            <span className="bg-accent-light text-accent rounded-full px-2 py-0.5 text-[11px] font-medium">
              {sections.length}
            </span>
          </div>
          <Button
            size="sm"
            className="h-7 px-2.5 bg-accent text-white rounded-lg shadow-sm hover:shadow-glow-accent hover:bg-accent-hover text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Section Cards */}
      <motion.div
        className="flex-1 overflow-y-auto p-3 space-y-1.5"
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
      >
        {sections.map((section, index) => {
          const Icon = SECTION_ICONS[section.sectionType] || Code;
          const label = SECTION_LABELS[section.sectionType] || section.sectionType;
          const subtitle = SECTION_SUBTITLES[section.sectionType] || '';
          const color = SECTION_COLORS[section.sectionType] || DEFAULT_COLOR;
          const isSelected = selectedSectionId === section.id;
          const isDragging = draggingIndex === index;
          const isDragOver = dragOverIndex === index && draggingIndex !== null && draggingIndex !== index;

          return (
            <motion.div
              key={section.id}
              variants={fadeSlideUpVariants}
              layout
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => selectSection(section.id)}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-200',
                isSelected
                  ? 'border-accent/40 bg-accent-light shadow-sm ring-1 ring-accent/20'
                  : 'border-border/30 bg-surface hover:bg-surface-elevated hover:shadow-sm',
                isDragging && 'scale-[1.03] shadow-xl rotate-1 z-10 border-accent/50 opacity-80',
                isDragOver && 'border-2 border-dashed border-accent/40 bg-accent/5',
                !section.isVisible && 'opacity-50',
              )}
            >
              {/* Color-coded icon */}
              <div className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                color.bg,
              )}>
                <Icon className={cn('h-5 w-5', color.text)} />
              </div>

              {/* Title + subtitle */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium truncate',
                  isSelected ? 'text-text' : 'text-text-secondary',
                )}>
                  {label}
                </p>
                {subtitle && (
                  <p className="text-[11px] text-text-muted truncate">{subtitle}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                {/* Reorder arrows */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleMoveUp(index); }}
                  className={cn(
                    'p-1 rounded-md hover:bg-surface-hover transition-colors',
                    index === 0 && 'opacity-30 pointer-events-none',
                  )}
                  title="Move up"
                >
                  <ChevronUp className="h-3.5 w-3.5 text-text-muted" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleMoveDown(index); }}
                  className={cn(
                    'p-1 rounded-md hover:bg-surface-hover transition-colors',
                    index >= sections.length - 1 && 'opacity-30 pointer-events-none',
                  )}
                  title="Move down"
                >
                  <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                </button>

                {/* Visibility */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleVisibility(section); }}
                  className="p-1 rounded-md hover:bg-surface-hover transition-colors"
                  title={section.isVisible ? 'Hide section' : 'Show section'}
                >
                  {section.isVisible
                    ? <Eye className="h-3.5 w-3.5 text-text-muted" />
                    : <EyeOff className="h-3.5 w-3.5 text-text-muted" />
                  }
                </button>

                {/* Delete */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(section); }}
                  className="p-1 rounded-md hover:bg-error/10 transition-colors"
                  title="Delete section"
                >
                  <Trash2 className="h-3.5 w-3.5 text-text-muted group-hover:text-error/70" />
                </button>
              </div>
            </motion.div>
          );
        })}

        {sections.length === 0 && (
          <div className="text-center py-12">
            <div className="h-12 w-12 rounded-2xl bg-surface-elevated border border-border/30 flex items-center justify-center mx-auto mb-3">
              <Plus className="h-5 w-5 text-text-muted" />
            </div>
            <p className="text-sm text-text-muted">No sections yet</p>
            <p className="text-xs text-text-muted mt-1">Add your first section to get started</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
