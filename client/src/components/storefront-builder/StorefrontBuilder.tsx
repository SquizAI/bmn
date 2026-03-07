import { useStorefrontStore } from '@/stores/storefront-store';
import { SectionList } from './SectionList';
import { SectionEditor } from './SectionEditor';
import { PublishControls } from './PublishControls';
import { TestimonialManager } from './TestimonialManager';
import { FaqManager } from './FaqManager';
import { StorefrontAnalytics } from './StorefrontAnalytics';
import { StorefrontSettings } from './StorefrontSettings';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  Eye, EyeOff, Monitor, Tablet, Smartphone,
  LayoutGrid, MessageSquareQuote, HelpCircle, BarChart3, Settings,
  Globe,
} from 'lucide-react';

const TABS = [
  { id: 'editor' as const, label: 'Sections', icon: LayoutGrid },
  { id: 'testimonials' as const, label: 'Testimonials', icon: MessageSquareQuote },
  { id: 'faqs' as const, label: 'FAQs', icon: HelpCircle },
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
];

const DEVICES = [
  { id: 'desktop' as const, icon: Monitor, label: 'Desktop' },
  { id: 'tablet' as const, icon: Tablet, label: 'Tablet' },
  { id: 'mobile' as const, icon: Smartphone, label: 'Mobile' },
];

export function StorefrontBuilder() {
  const {
    storefront, activeTab, setActiveTab,
    isPreviewOpen, togglePreview, previewDevice, setPreviewDevice,
  } = useStorefrontStore();

  if (!storefront) return null;

  const storeUrl = `https://${storefront.slug}.brandmenow.store`;

  return (
    <motion.div
      className="h-full flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Top Bar -- Glassmorphism Toolbar */}
      <motion.div
        className="border-b border-border/50 bg-surface/80 backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-surface-elevated border border-border rounded-full px-4 py-1.5 hover:shadow-glow-accent transition-shadow duration-200">
            <Globe className="h-4 w-4 text-accent" />
            <span className="font-medium text-sm">{storefront.slug}.brandmenow.store</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Device toggles */}
          <div className="flex items-center bg-surface-elevated rounded-xl p-1 gap-1 border border-border/50">
            {DEVICES.map((d) => (
              <button
                key={d.id}
                onClick={() => setPreviewDevice(d.id)}
                className={cn(
                  'h-7 w-7 flex items-center justify-center rounded-lg transition-all duration-150',
                  previewDevice === d.id
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
                )}
                title={d.label}
              >
                <d.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          {/* Preview toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={togglePreview}
            className="gap-1.5"
          >
            {isPreviewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {isPreviewOpen ? 'Close Preview' : 'Preview'}
          </Button>

          <PublishControls />
        </div>
      </motion.div>

      {/* Tab Navigation -- Pill Segmented Control */}
      <div className="border-b border-border/30 bg-surface/40 backdrop-blur-sm px-4 py-2">
        <div className="relative flex items-center bg-surface-elevated/50 rounded-xl p-1.5 border border-border/30 w-fit gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 z-10',
                  isActive
                    ? 'text-text'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeStorefrontTab"
                    className="absolute inset-0 bg-surface shadow-sm rounded-lg border border-border/30"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <tab.icon className={cn('h-4 w-4 relative z-10', isActive && 'text-accent')} />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {isPreviewOpen ? (
            <motion.div
              key="preview"
              className="h-full flex items-center justify-center p-6"
              style={{
                backgroundImage: 'radial-gradient(circle, var(--bmn-color-border) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className={cn(
                  'bg-white rounded-2xl shadow-2xl ring-1 ring-border/20 overflow-hidden transition-all duration-300',
                  previewDevice === 'desktop' ? 'w-full h-full' :
                  previewDevice === 'tablet' ? 'w-[768px] h-[1024px]' :
                  'w-[375px] h-[812px]',
                )}
              >
                <iframe
                  src={storeUrl}
                  className="w-full h-full border-0"
                  title="Storefront Preview"
                />
              </div>
            </motion.div>
          ) : activeTab === 'editor' ? (
            <motion.div
              key="editor"
              className="h-full grid grid-cols-[288px_1fr]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Sidebar: Section List */}
              <div className="border-r border-border/30 bg-surface/50 overflow-y-auto">
                <SectionList />
              </div>
              {/* Main: Section Editor */}
              <div className="flex-1 overflow-y-auto p-6">
                <SectionEditor />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              className={cn(
                'overflow-y-auto h-full',
                activeTab === 'analytics' ? 'p-6' : 'p-6 max-w-3xl mx-auto',
              )}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'testimonials' && <TestimonialManager />}
              {activeTab === 'faqs' && <FaqManager />}
              {activeTab === 'analytics' && <StorefrontAnalytics />}
              {activeTab === 'settings' && <StorefrontSettings />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
