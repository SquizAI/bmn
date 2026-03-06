import { useStorefrontStore } from '@/stores/storefront-store';
import { SectionList } from './SectionList';
import { SectionEditor } from './SectionEditor';
import { PublishControls } from './PublishControls';
import { TestimonialManager } from './TestimonialManager';
import { FaqManager } from './FaqManager';
import { StorefrontAnalytics } from './StorefrontAnalytics';
import { StorefrontSettings } from './StorefrontSettings';
import { Button } from '@/components/ui/button';
import {
  Store, Eye, EyeOff, Monitor, Tablet, Smartphone,
  LayoutGrid, MessageSquareQuote, HelpCircle, BarChart3, Settings,
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
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="border-b bg-background px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Store className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-lg">{storefront.slug}.brandmenow.store</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Device toggles */}
          <div className="flex items-center border rounded-lg p-0.5 gap-0.5">
            {DEVICES.map((d) => (
              <Button
                key={d.id}
                variant={previewDevice === d.id ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setPreviewDevice(d.id)}
                title={d.label}
              >
                <d.icon className="h-3.5 w-3.5" />
              </Button>
            ))}
          </div>

          {/* Preview toggle */}
          <Button variant="outline" size="sm" onClick={togglePreview}>
            {isPreviewOpen ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
            {isPreviewOpen ? 'Close Preview' : 'Preview'}
          </Button>

          <PublishControls />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b bg-muted/30 px-4 flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
              }
            `}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {isPreviewOpen ? (
          <div className="h-full flex items-center justify-center bg-muted/50 p-4">
            <div
              className={`bg-white rounded-lg shadow-xl overflow-hidden transition-all ${
                previewDevice === 'desktop' ? 'w-full h-full' :
                previewDevice === 'tablet' ? 'w-[768px] h-[1024px]' :
                'w-[375px] h-[812px]'
              }`}
            >
              <iframe
                src={storeUrl}
                className="w-full h-full border-0"
                title="Storefront Preview"
              />
            </div>
          </div>
        ) : activeTab === 'editor' ? (
          <div className="h-full flex">
            {/* Sidebar: Section List */}
            <div className="w-72 border-r bg-muted/20 overflow-y-auto">
              <SectionList />
            </div>
            {/* Main: Section Editor */}
            <div className="flex-1 overflow-y-auto p-6">
              <SectionEditor />
            </div>
          </div>
        ) : activeTab === 'testimonials' ? (
          <div className="overflow-y-auto p-6 max-w-3xl mx-auto">
            <TestimonialManager />
          </div>
        ) : activeTab === 'faqs' ? (
          <div className="overflow-y-auto p-6 max-w-3xl mx-auto">
            <FaqManager />
          </div>
        ) : activeTab === 'analytics' ? (
          <div className="overflow-y-auto p-6">
            <StorefrontAnalytics />
          </div>
        ) : activeTab === 'settings' ? (
          <div className="overflow-y-auto p-6 max-w-2xl mx-auto">
            <StorefrontSettings />
          </div>
        ) : null}
      </div>
    </div>
  );
}
