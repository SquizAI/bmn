import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Palette,
  Pencil,
  Check,
  X,
  Plus,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ColorPalette, type ColorEntry } from '@/components/color-palette';
import { useBrandDetail, type BrandIdentity } from '@/hooks/use-brand-detail';
import { useUIStore } from '@/stores/ui-store';
import { apiClient } from '@/lib/api';
import { ROUTES, QUERY_KEYS } from '@/lib/constants';
import { cn } from '@/lib/utils';

// ------ Archetype Options ------

const ARCHETYPES = [
  'The Innocent',
  'The Sage',
  'The Explorer',
  'The Outlaw',
  'The Magician',
  'The Hero',
  'The Lover',
  'The Jester',
  'The Everyman',
  'The Caregiver',
  'The Ruler',
  'The Creator',
] as const;

// ------ Inline Editable Field ------

interface EditableFieldProps {
  label: string;
  value: string;
  fieldKey: string;
  multiline?: boolean;
  editing: string | null;
  onStartEdit: (key: string) => void;
  onSave: (key: string, value: string) => void;
  onCancel: () => void;
}

function EditableField({
  label,
  value,
  fieldKey,
  multiline = false,
  editing,
  onStartEdit,
  onSave,
  onCancel,
}: EditableFieldProps) {
  const [draft, setDraft] = useState(value);
  const isEditing = editing === fieldKey;

  const handleStartEdit = () => {
    setDraft(value);
    onStartEdit(fieldKey);
  };

  const handleSave = () => {
    onSave(fieldKey, draft);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </p>
        {!isEditing && (
          <button
            type="button"
            onClick={handleStartEdit}
            className="text-text-muted hover:text-primary transition-colors"
            aria-label={`Edit ${label}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          {multiline ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className={cn(
                'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text',
                'placeholder:text-text-muted',
                'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
                'resize-y',
              )}
              autoFocus
            />
          ) : (
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="text-sm"
              autoFocus
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} leftIcon={<Check className="h-3.5 w-3.5" />}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel} leftIcon={<X className="h-3.5 w-3.5" />}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-text">{value || <span className="italic text-text-muted">Not set</span>}</p>
      )}
    </div>
  );
}

// ------ Tag Input for Values ------

interface TagInputProps {
  tags: string[];
  editing: boolean;
  onStartEdit: () => void;
  onSave: (tags: string[]) => void;
  onCancel: () => void;
}

function TagInput({ tags, editing, onStartEdit, onSave, onCancel }: TagInputProps) {
  const [draft, setDraft] = useState<string[]>(tags);
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !draft.includes(trimmed)) {
      setDraft([...draft, trimmed]);
      setInputValue('');
    }
  };

  const handleRemove = (tag: string) => {
    setDraft(draft.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleStartEdit = () => {
    setDraft(tags);
    setInputValue('');
    onStartEdit();
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Values
        </p>
        {!editing && (
          <button
            type="button"
            onClick={handleStartEdit}
            className="text-text-muted hover:text-primary transition-colors"
            aria-label="Edit values"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {draft.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemove(tag)}
                  className="hover:text-error transition-colors"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a value and press Enter"
              className="flex-1 text-sm"
              autoFocus
            />
            <Button size="sm" variant="outline" onClick={handleAdd} leftIcon={<Plus className="h-3.5 w-3.5" />}>
              Add
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onSave(draft)} leftIcon={<Check className="h-3.5 w-3.5" />}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel} leftIcon={<X className="h-3.5 w-3.5" />}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.length > 0 ? (
            tags.map((value) => (
              <span
                key={value}
                className="rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary"
              >
                {value}
              </span>
            ))
          ) : (
            <span className="text-sm italic text-text-muted">No values set</span>
          )}
        </div>
      )}
    </div>
  );
}

// ------ Main Component ------

export default function BrandIdentityEditPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const { data: brand, isLoading, error } = useBrandDetail(brandId);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const identity = brand?.identity;

  const saveIdentityField = useCallback(
    async (updates: Partial<BrandIdentity>) => {
      if (!brandId || !identity) return;
      setSaving(true);
      try {
        await apiClient.patch(`/api/v1/brands/${brandId}`, {
          identity: { ...identity, ...updates },
        });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.brand(brandId) });
        setEditingField(null);
        addToast({ type: 'success', title: 'Identity updated' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save';
        addToast({ type: 'error', title: message });
      } finally {
        setSaving(false);
      }
    },
    [brandId, identity, queryClient, addToast],
  );

  const handleFieldSave = useCallback(
    (key: string, value: string) => {
      saveIdentityField({ [key]: value });
    },
    [saveIdentityField],
  );

  const handleArchetypeSave = useCallback(
    (archetype: string) => {
      saveIdentityField({ archetype });
    },
    [saveIdentityField],
  );

  const handleValuesSave = useCallback(
    (values: string[]) => {
      saveIdentityField({ values });
    },
    [saveIdentityField],
  );

  const handleColorsSave = useCallback(
    (colors: ColorEntry[]) => {
      saveIdentityField({
        colorPalette: colors.map((c) => ({ hex: c.hex, name: c.name, role: c.role })),
      });
    },
    [saveIdentityField],
  );

  const handleFontsSave = useCallback(
    (key: 'primary' | 'secondary', value: string) => {
      if (!identity?.fonts) return;
      saveIdentityField({
        fonts: { ...identity.fonts, [key]: value },
      });
    },
    [identity, saveIdentityField],
  );

  // ------ Loading / Error States ------

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-lg text-text-secondary">Brand not found</p>
        <Link to={ROUTES.DASHBOARD}>
          <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={ROUTES.DASHBOARD_BRAND_DETAIL(brand.id)}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text">{brand.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Palette className="h-4 w-4 text-primary" />
            <span className="text-sm text-text-secondary">Brand Identity</span>
          </div>
        </div>
        {saving && <Spinner size="sm" className="ml-auto" />}
      </div>

      {!identity ? (
        <Card variant="outlined" padding="lg">
          <p className="text-text-secondary text-center py-8">
            No brand identity has been generated yet. Complete the brand wizard to create one.
          </p>
        </Card>
      ) : (
        <>
          {/* Vision & Archetype */}
          <Card variant="outlined" padding="lg">
            <div className="flex items-center gap-2 mb-6">
              <CardTitle>Core Identity</CardTitle>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <EditableField
                label="Vision"
                value={identity.vision}
                fieldKey="vision"
                multiline
                editing={editingField}
                onStartEdit={setEditingField}
                onSave={handleFieldSave}
                onCancel={() => setEditingField(null)}
              />

              {/* Archetype -- dropdown */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Archetype
                  </p>
                  {editingField !== 'archetype' && (
                    <button
                      type="button"
                      onClick={() => setEditingField('archetype')}
                      className="text-text-muted hover:text-primary transition-colors"
                      aria-label="Edit archetype"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {editingField === 'archetype' ? (
                  <div className="flex flex-col gap-2">
                    <select
                      value={identity.archetype}
                      onChange={(e) => handleArchetypeSave(e.target.value)}
                      className={cn(
                        'h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text',
                        'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
                      )}
                    >
                      {ARCHETYPES.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingField(null)}
                      leftIcon={<X className="h-3.5 w-3.5" />}
                    >
                      Close
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-text">
                    {identity.archetype || <span className="italic text-text-muted">Not set</span>}
                  </p>
                )}
              </div>

              {/* Values -- tag input */}
              <TagInput
                tags={identity.values ?? []}
                editing={editingField === 'values'}
                onStartEdit={() => setEditingField('values')}
                onSave={handleValuesSave}
                onCancel={() => setEditingField(null)}
              />

              <EditableField
                label="Target Audience"
                value={identity.targetAudience}
                fieldKey="targetAudience"
                multiline
                editing={editingField}
                onStartEdit={setEditingField}
                onSave={handleFieldSave}
                onCancel={() => setEditingField(null)}
              />
            </div>
          </Card>

          {/* Color Palette */}
          <Card variant="outlined" padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle>Color Palette</CardTitle>
            </div>

            <ColorPalette
              colors={(identity.colorPalette ?? []).map((c) => ({
                hex: c.hex,
                name: c.name,
                role: c.role as ColorEntry['role'],
              }))}
              editable
              onChange={handleColorsSave}
            />
          </Card>

          {/* Typography */}
          <Card variant="outlined" padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <Type className="h-5 w-5 text-text-muted" />
              <CardTitle>Typography</CardTitle>
            </div>

            {identity.fonts ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Primary Font */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Primary Font
                    </p>
                    {editingField !== 'font-primary' && (
                      <button
                        type="button"
                        onClick={() => setEditingField('font-primary')}
                        className="text-text-muted hover:text-primary transition-colors"
                        aria-label="Edit primary font"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {editingField === 'font-primary' ? (
                    <FontEditor
                      value={identity.fonts.primary}
                      onSave={(v) => handleFontsSave('primary', v)}
                      onCancel={() => setEditingField(null)}
                    />
                  ) : (
                    <div className="rounded-lg bg-surface-hover p-3">
                      <p
                        className="text-lg font-semibold text-text"
                        style={{ fontFamily: identity.fonts.primary }}
                      >
                        {identity.fonts.primary}
                      </p>
                    </div>
                  )}
                </div>

                {/* Secondary Font */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Secondary Font
                    </p>
                    {editingField !== 'font-secondary' && (
                      <button
                        type="button"
                        onClick={() => setEditingField('font-secondary')}
                        className="text-text-muted hover:text-primary transition-colors"
                        aria-label="Edit secondary font"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {editingField === 'font-secondary' ? (
                    <FontEditor
                      value={identity.fonts.secondary}
                      onSave={(v) => handleFontsSave('secondary', v)}
                      onCancel={() => setEditingField(null)}
                    />
                  ) : (
                    <div className="rounded-lg bg-surface-hover p-3">
                      <p
                        className="text-lg text-text"
                        style={{ fontFamily: identity.fonts.secondary }}
                      >
                        {identity.fonts.secondary}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm italic text-text-muted">No fonts configured</p>
            )}
          </Card>
        </>
      )}
    </motion.div>
  );
}

// ------ Font Editor Sub-component ------

function FontEditor({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Font family name"
        className="text-sm"
        autoFocus
      />
      <div className="rounded-lg bg-surface-hover p-3">
        <p className="text-lg text-text" style={{ fontFamily: draft }}>
          {draft || 'Preview'}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(draft)} leftIcon={<Check className="h-3.5 w-3.5" />}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} leftIcon={<X className="h-3.5 w-3.5" />}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
