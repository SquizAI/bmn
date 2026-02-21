import { useCallback } from 'react';
import type { BrandingZone } from '@/hooks/use-admin-templates';

interface ZonePropertyPanelProps {
  zone: BrandingZone;
  onZoneChange: (zone: BrandingZone) => void;
}

export default function ZonePropertyPanel({ zone, onZoneChange }: ZonePropertyPanelProps) {
  const updateField = useCallback(
    <K extends keyof BrandingZone>(key: K, value: BrandingZone[K]) => {
      onZoneChange({ ...zone, [key]: value });
    },
    [zone, onZoneChange],
  );

  const updatePosition = useCallback(
    (key: keyof BrandingZone['position'], value: number) => {
      onZoneChange({
        ...zone,
        position: { ...zone.position, [key]: value },
      });
    },
    [zone, onZoneChange],
  );

  const updateConstraint = useCallback(
    (key: string, value: unknown) => {
      onZoneChange({
        ...zone,
        constraints: { ...zone.constraints, [key]: value },
      });
    },
    [zone, onZoneChange],
  );

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-text">Zone Properties</h4>

      {/* ID */}
      <div>
        <label className="block text-xs text-text-muted mb-1">ID</label>
        <input
          type="text"
          value={zone.id}
          onChange={(e) =>
            updateField('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
          }
          className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text"
        />
      </div>

      {/* Label */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Label</label>
        <input
          type="text"
          value={zone.label}
          onChange={(e) => updateField('label', e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text"
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Type</label>
        <select
          value={zone.type}
          onChange={(e) => updateField('type', e.target.value as BrandingZone['type'])}
          className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text"
        >
          <option value="logo">Logo</option>
          <option value="text">Text</option>
          <option value="color_fill">Color Fill</option>
          <option value="pattern">Pattern</option>
        </select>
      </div>

      {/* Position */}
      <div>
        <label className="block text-xs text-text-muted mb-1">Position (%)</label>
        <div className="grid grid-cols-2 gap-2">
          {(['x', 'y', 'width', 'height'] as const).map((key) => (
            <div key={key}>
              <label className="block text-[10px] uppercase text-text-muted">{key}</label>
              <input
                type="number"
                min={key === 'width' || key === 'height' ? 1 : 0}
                max={100}
                step={0.1}
                value={zone.position[key]}
                onChange={(e) => updatePosition(key, parseFloat(e.target.value) || 0)}
                className="w-full rounded border border-border bg-surface px-2 py-1 text-xs text-text"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Type-specific constraints */}
      {zone.type === 'logo' && (
        <div className="space-y-2">
          <label className="block text-xs text-text-muted mb-1">Logo Constraints</label>
          <label className="flex items-center gap-2 text-xs text-text">
            <input
              type="checkbox"
              checked={!!zone.constraints.required}
              onChange={(e) => updateConstraint('required', e.target.checked)}
              className="rounded border-border"
            />
            Required
          </label>
          <label className="flex items-center gap-2 text-xs text-text">
            <input
              type="checkbox"
              checked={zone.constraints.rotation_allowed !== false}
              onChange={(e) => updateConstraint('rotation_allowed', e.target.checked)}
              className="rounded border-border"
            />
            Allow Rotation
          </label>
        </div>
      )}

      {zone.type === 'text' && (
        <div className="space-y-2">
          <label className="block text-xs text-text-muted mb-1">Text Constraints</label>
          <div>
            <label className="block text-[10px] uppercase text-text-muted">Max Characters</label>
            <input
              type="number"
              min={1}
              max={200}
              value={(zone.constraints.max_chars as number) || 50}
              onChange={(e) => updateConstraint('max_chars', parseInt(e.target.value))}
              className="w-full rounded border border-border bg-surface px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-text-muted">Alignment</label>
            <select
              value={(zone.constraints.alignment as string) || 'center'}
              onChange={(e) => updateConstraint('alignment', e.target.value)}
              className="w-full rounded border border-border bg-surface px-2 py-1 text-xs"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      )}

      {zone.type === 'color_fill' && (
        <div className="space-y-2">
          <label className="block text-xs text-text-muted mb-1">Color Fill Style</label>
          <div>
            <label className="block text-[10px] uppercase text-text-muted">Default Opacity</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={(zone.style.default_opacity as number) ?? 1}
              onChange={(e) =>
                onZoneChange({
                  ...zone,
                  style: { ...zone.style, default_opacity: parseFloat(e.target.value) },
                })
              }
              className="w-full"
            />
            <span className="text-[10px] text-text-muted">
              {((zone.style.default_opacity as number) ?? 1).toFixed(2)}
            </span>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-text-muted">Z-Index</label>
            <input
              type="number"
              value={(zone.constraints.z_index as number) ?? 0}
              onChange={(e) => updateConstraint('z_index', parseInt(e.target.value))}
              className="w-full rounded border border-border bg-surface px-2 py-1 text-xs"
            />
          </div>
        </div>
      )}

      {zone.type === 'pattern' && (
        <div className="space-y-2">
          <label className="block text-xs text-text-muted mb-1">Pattern Settings</label>
          <div>
            <label className="block text-[10px] uppercase text-text-muted">Repeat Mode</label>
            <select
              value={(zone.constraints.repeat as string) || 'tile'}
              onChange={(e) => updateConstraint('repeat', e.target.value)}
              className="w-full rounded border border-border bg-surface px-2 py-1 text-xs"
            >
              <option value="tile">Tile</option>
              <option value="stretch">Stretch</option>
              <option value="fit">Fit</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-text-muted">Z-Index</label>
            <input
              type="number"
              value={(zone.constraints.z_index as number) ?? 0}
              onChange={(e) => updateConstraint('z_index', parseInt(e.target.value))}
              className="w-full rounded border border-border bg-surface px-2 py-1 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
