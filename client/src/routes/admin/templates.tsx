import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Plus, ArrowLeft, Save, Trash2, Image, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  useAdminTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '@/hooks/use-admin-templates';
import type { PackagingTemplate, BrandingZone, PrintSpecs } from '@/hooks/use-admin-templates';
import ZoneEditor from '@/components/admin/ZoneEditor';
import ZonePropertyPanel from '@/components/admin/ZonePropertyPanel';
import { useUIStore } from '@/stores/ui-store';

// ------ Types ------

type ViewMode = 'list' | 'edit' | 'create';

interface TemplateFormState {
  slug: string;
  name: string;
  category: string;
  description: string;
  template_image_url: string;
  template_width_px: number;
  template_height_px: number;
  ai_prompt_template: string;
  branding_zones: BrandingZone[];
  print_specs: PrintSpecs;
  reference_images: string[];
}

const DEFAULT_PRINT_SPECS: PrintSpecs = {
  dpi: 300,
  bleed_mm: 3,
  safe_area_mm: 5,
  color_space: 'CMYK',
};

const DEFAULT_FORM_STATE: TemplateFormState = {
  slug: '',
  name: '',
  category: '',
  description: '',
  template_image_url: '',
  template_width_px: 1024,
  template_height_px: 1024,
  ai_prompt_template: '',
  branding_zones: [],
  print_specs: DEFAULT_PRINT_SPECS,
  reference_images: [],
};

// ------ Helpers ------

const CATEGORY_OPTIONS = [
  'apparel',
  'drinkware',
  'accessories',
  'stationery',
  'home-decor',
  'packaging',
  'tech',
  'other',
];

// ------ Component ------

export default function AdminTemplatesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormState>(DEFAULT_FORM_STATE);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);

  const addToast = useUIStore((s) => s.addToast);

  const { data, isLoading } = useAdminTemplates({
    category: categoryFilter,
  });
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const templates = data?.items || [];

  // ------ Handlers ------

  const handleCreate = () => {
    setForm(DEFAULT_FORM_STATE);
    setEditingId(null);
    setSelectedZoneId(null);
    setViewMode('create');
  };

  const handleEdit = (template: PackagingTemplate) => {
    setForm({
      slug: template.slug,
      name: template.name,
      category: template.category,
      description: template.description,
      template_image_url: template.template_image_url,
      template_width_px: template.template_width_px,
      template_height_px: template.template_height_px,
      ai_prompt_template: template.ai_prompt_template,
      branding_zones: template.branding_zones || [],
      print_specs: template.print_specs || DEFAULT_PRINT_SPECS,
      reference_images: template.reference_images || [],
    });
    setEditingId(template.id);
    setSelectedZoneId(null);
    setViewMode('edit');
  };

  const handleDelete = (template: PackagingTemplate) => {
    if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) return;
    deleteTemplate.mutate(template.id, {
      onSuccess: () => addToast({ type: 'success', title: 'Template deleted' }),
      onError: () => addToast({ type: 'error', title: 'Failed to delete template' }),
    });
  };

  const handleBack = () => {
    setViewMode('list');
    setEditingId(null);
    setSelectedZoneId(null);
  };

  const handleSave = () => {
    if (viewMode === 'create') {
      createTemplate.mutate(form, {
        onSuccess: () => {
          addToast({ type: 'success', title: 'Template created' });
          handleBack();
        },
        onError: () => addToast({ type: 'error', title: 'Failed to create template' }),
      });
    } else if (editingId) {
      updateTemplate.mutate(
        { templateId: editingId, ...form },
        {
          onSuccess: () => {
            addToast({ type: 'success', title: 'Template updated' });
            handleBack();
          },
          onError: () => addToast({ type: 'error', title: 'Failed to update template' }),
        },
      );
    }
  };

  const updateFormField = useCallback(
    <K extends keyof TemplateFormState>(key: K, value: TemplateFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updatePrintSpec = useCallback(
    <K extends keyof PrintSpecs>(key: K, value: PrintSpecs[K]) => {
      setForm((prev) => ({
        ...prev,
        print_specs: { ...prev.print_specs, [key]: value },
      }));
    },
    [],
  );

  const handleZonesChange = useCallback((zones: BrandingZone[]) => {
    setForm((prev) => ({ ...prev, branding_zones: zones }));
  }, []);

  const handleZoneChange = useCallback(
    (updatedZone: BrandingZone) => {
      setForm((prev) => ({
        ...prev,
        branding_zones: prev.branding_zones.map((z) =>
          z.id === updatedZone.id ? updatedZone : z,
        ),
      }));
    },
    [],
  );

  const selectedZone = form.branding_zones.find((z) => z.id === selectedZoneId) || null;

  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  // ------ Render: List View ------

  if (viewMode === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col gap-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-text">Packaging Templates</h1>
          </div>
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={handleCreate}
          >
            Create Template
          </Button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter(undefined)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !categoryFilter
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-secondary hover:text-text'
            }`}
          >
            All
          </button>
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                categoryFilter === cat
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-text-secondary hover:text-text'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : templates.length === 0 ? (
          <Card variant="outlined" padding="lg" className="text-center">
            <Layers className="mx-auto h-10 w-10 text-text-muted" />
            <p className="mt-2 text-text-secondary">
              No templates yet. Create your first packaging template above.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                variant="outlined"
                padding="none"
                className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleEdit(template)}
              >
                {template.template_image_url ? (
                  <img
                    src={template.template_image_url}
                    alt={template.name}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-surface-hover">
                    <Image className="h-10 w-10 text-text-muted" />
                  </div>
                )}

                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-text">{template.name}</h3>
                      <p className="text-xs text-text-muted capitalize">{template.category}</p>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                      <Package className="h-3 w-3" />
                      {template.branding_zones?.length || 0} zones
                    </span>
                  </div>

                  {template.description && (
                    <p className="mt-1.5 text-xs text-text-muted line-clamp-2">
                      {template.description}
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(template);
                      }}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(template);
                      }}
                      className="text-error hover:bg-error-bg"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    );
  }

  // ------ Render: Edit / Create View ------

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-text">
              {viewMode === 'create' ? 'New Template' : 'Edit Template'}
            </h1>
            {form.name && (
              <p className="text-xs text-text-muted">{form.name}</p>
            )}
          </div>
        </div>
        <Button
          leftIcon={<Save className="h-4 w-4" />}
          onClick={handleSave}
          loading={isSaving}
        >
          {viewMode === 'create' ? 'Create Template' : 'Save Changes'}
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Zone Editor (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Zone Editor */}
          <Card variant="outlined" padding="lg">
            <h3 className="mb-3 text-sm font-semibold text-text">Branding Zones</h3>
            <ZoneEditor
              templateImageUrl={form.template_image_url}
              zones={form.branding_zones}
              onZonesChange={handleZonesChange}
              selectedZoneId={selectedZoneId}
              onSelectZone={setSelectedZoneId}
            />
          </Card>

          {/* AI Prompt Template */}
          <Card variant="outlined" padding="lg">
            <h3 className="mb-3 text-sm font-semibold text-text">AI Prompt Template</h3>
            <p className="mb-2 text-xs text-text-muted">
              Use placeholders: {'{{brand_name}}'}, {'{{brand_colors}}'}, {'{{logo_url}}'}, {'{{product_category}}'}, {'{{brand_style}}'}
            </p>
            <textarea
              value={form.ai_prompt_template}
              onChange={(e) => updateFormField('ai_prompt_template', e.target.value)}
              rows={6}
              className="min-h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Generate a product mockup for {{brand_name}} featuring their logo placed on a {{product_category}}. Use brand colors: {{brand_colors}}. Style: {{brand_style}}."
            />
          </Card>
        </div>

        {/* Right: Properties (1 col) */}
        <div className="space-y-6">
          {/* Template metadata */}
          <Card variant="outlined" padding="lg">
            <h3 className="mb-3 text-sm font-semibold text-text">Template Details</h3>
            <div className="space-y-3">
              <Input
                label="Slug"
                value={form.slug}
                onChange={(e) =>
                  updateFormField(
                    'slug',
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                  )
                }
                placeholder="e.g. coffee-mug-11oz"
              />
              <Input
                label="Name"
                value={form.name}
                onChange={(e) => updateFormField('name', e.target.value)}
                placeholder="Template name"
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => updateFormField('category', e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select category</option>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  rows={3}
                  className="min-h-16 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Template description..."
                />
              </div>
              <Input
                label="Template Image URL"
                value={form.template_image_url}
                onChange={(e) => updateFormField('template_image_url', e.target.value)}
                placeholder="https://..."
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Width (px)"
                  type="number"
                  value={form.template_width_px}
                  onChange={(e) =>
                    updateFormField('template_width_px', parseInt(e.target.value) || 0)
                  }
                />
                <Input
                  label="Height (px)"
                  type="number"
                  value={form.template_height_px}
                  onChange={(e) =>
                    updateFormField('template_height_px', parseInt(e.target.value) || 0)
                  }
                />
              </div>
            </div>
          </Card>

          {/* Print specs */}
          <Card variant="outlined" padding="lg">
            <h3 className="mb-3 text-sm font-semibold text-text">Print Specifications</h3>
            <div className="space-y-3">
              <Input
                label="DPI"
                type="number"
                value={form.print_specs.dpi}
                onChange={(e) => updatePrintSpec('dpi', parseInt(e.target.value) || 300)}
              />
              <Input
                label="Bleed (mm)"
                type="number"
                step={0.5}
                value={form.print_specs.bleed_mm}
                onChange={(e) => updatePrintSpec('bleed_mm', parseFloat(e.target.value) || 0)}
              />
              <Input
                label="Safe Area (mm)"
                type="number"
                step={0.5}
                value={form.print_specs.safe_area_mm}
                onChange={(e) => updatePrintSpec('safe_area_mm', parseFloat(e.target.value) || 0)}
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Color Space</label>
                <select
                  value={form.print_specs.color_space}
                  onChange={(e) =>
                    updatePrintSpec('color_space', e.target.value as 'RGB' | 'CMYK')
                  }
                  className="h-9 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="CMYK">CMYK</option>
                  <option value="RGB">RGB</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Print Width (mm)"
                  type="number"
                  step={0.5}
                  value={form.print_specs.print_width_mm || ''}
                  onChange={(e) =>
                    updatePrintSpec(
                      'print_width_mm',
                      e.target.value ? parseFloat(e.target.value) : undefined,
                    )
                  }
                />
                <Input
                  label="Print Height (mm)"
                  type="number"
                  step={0.5}
                  value={form.print_specs.print_height_mm || ''}
                  onChange={(e) =>
                    updatePrintSpec(
                      'print_height_mm',
                      e.target.value ? parseFloat(e.target.value) : undefined,
                    )
                  }
                />
              </div>
            </div>
          </Card>

          {/* Zone property panel */}
          <AnimatePresence>
            {selectedZone && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <Card variant="outlined" padding="lg">
                  <ZonePropertyPanel
                    zone={selectedZone}
                    onZoneChange={handleZoneChange}
                  />
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
