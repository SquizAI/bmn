import { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2 } from 'lucide-react';
import type { BrandingZone } from '@/hooks/use-admin-templates';

interface ZoneEditorProps {
  templateImageUrl: string;
  zones: BrandingZone[];
  onZonesChange: (zones: BrandingZone[]) => void;
  selectedZoneId: string | null;
  onSelectZone: (id: string | null) => void;
}

const ZONE_COLORS: Record<BrandingZone['type'], string> = {
  logo: 'rgba(59, 130, 246, 0.3)',
  text: 'rgba(34, 197, 94, 0.3)',
  color_fill: 'rgba(249, 115, 22, 0.3)',
  pattern: 'rgba(168, 85, 247, 0.3)',
};

const ZONE_BORDER_COLORS: Record<BrandingZone['type'], string> = {
  logo: '#3b82f6',
  text: '#22c55e',
  color_fill: '#f97316',
  pattern: '#a855f7',
};

export default function ZoneEditor({
  templateImageUrl,
  zones,
  onZonesChange,
  selectedZoneId,
  onSelectZone,
}: ZoneEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [drawMode, setDrawMode] = useState(false);
  const [newZoneType, setNewZoneType] = useState<BrandingZone['type']>('logo');

  const getRelativePosition = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
        y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!drawMode) return;
      e.preventDefault();
      const pos = getRelativePosition(e);
      setDrawStart(pos);
      setDrawCurrent(pos);
      setIsDrawing(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [drawMode, getRelativePosition],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDrawing) {
        setDrawCurrent(getRelativePosition(e));
      }
    },
    [isDrawing, getRelativePosition],
  );

  const handlePointerUp = useCallback(() => {
    if (isDrawing && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const width = Math.abs(drawCurrent.x - drawStart.x);
      const height = Math.abs(drawCurrent.y - drawStart.y);

      if (width > 2 && height > 2) {
        const newZone: BrandingZone = {
          id: `zone-${Date.now()}`,
          label: `New ${newZoneType} zone`,
          type: newZoneType,
          position: {
            x: Math.round((x + width / 2) * 10) / 10,
            y: Math.round((y + height / 2) * 10) / 10,
            width: Math.round(width * 10) / 10,
            height: Math.round(height * 10) / 10,
          },
          constraints: {},
          style: {},
        };
        onZonesChange([...zones, newZone]);
        onSelectZone(newZone.id);
      }

      setIsDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
      setDrawMode(false);
    }
  }, [isDrawing, drawStart, drawCurrent, newZoneType, zones, onZonesChange, onSelectZone]);

  const handleZoneDragStart = useCallback(
    (e: React.PointerEvent, zoneId: string) => {
      if (drawMode) return;
      e.stopPropagation();
      e.preventDefault();
      onSelectZone(zoneId);
      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) return;

      const pos = getRelativePosition(e);
      setDragOffset({
        x: pos.x - zone.position.x,
        y: pos.y - zone.position.y,
      });
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [drawMode, zones, getRelativePosition, onSelectZone],
  );

  const handleZoneDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !selectedZoneId) return;
      const pos = getRelativePosition(e);
      const updatedZones = zones.map((z) => {
        if (z.id !== selectedZoneId) return z;
        return {
          ...z,
          position: {
            ...z.position,
            x: Math.max(
              z.position.width / 2,
              Math.min(100 - z.position.width / 2, pos.x - dragOffset.x),
            ),
            y: Math.max(
              z.position.height / 2,
              Math.min(100 - z.position.height / 2, pos.y - dragOffset.y),
            ),
          },
        };
      });
      onZonesChange(updatedZones);
    },
    [isDragging, selectedZoneId, zones, dragOffset, getRelativePosition, onZonesChange],
  );

  const handleZoneDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const removeZone = useCallback(
    (zoneId: string) => {
      onZonesChange(zones.filter((z) => z.id !== zoneId));
      if (selectedZoneId === zoneId) onSelectZone(null);
    },
    [zones, selectedZoneId, onZonesChange, onSelectZone],
  );

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setDrawMode(true);
            setNewZoneType('logo');
          }}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            drawMode && newZoneType === 'logo'
              ? 'bg-blue-500 text-white'
              : 'bg-surface text-text-secondary hover:bg-surface-hover'
          }`}
        >
          <Plus className="h-3.5 w-3.5" /> Logo Zone
        </button>
        <button
          type="button"
          onClick={() => {
            setDrawMode(true);
            setNewZoneType('text');
          }}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            drawMode && newZoneType === 'text'
              ? 'bg-green-500 text-white'
              : 'bg-surface text-text-secondary hover:bg-surface-hover'
          }`}
        >
          <Plus className="h-3.5 w-3.5" /> Text Zone
        </button>
        <button
          type="button"
          onClick={() => {
            setDrawMode(true);
            setNewZoneType('color_fill');
          }}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            drawMode && newZoneType === 'color_fill'
              ? 'bg-orange-500 text-white'
              : 'bg-surface text-text-secondary hover:bg-surface-hover'
          }`}
        >
          <Plus className="h-3.5 w-3.5" /> Color Zone
        </button>
        <button
          type="button"
          onClick={() => {
            setDrawMode(true);
            setNewZoneType('pattern');
          }}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            drawMode && newZoneType === 'pattern'
              ? 'bg-purple-500 text-white'
              : 'bg-surface text-text-secondary hover:bg-surface-hover'
          }`}
        >
          <Plus className="h-3.5 w-3.5" /> Pattern Zone
        </button>
        {drawMode && (
          <button
            type="button"
            onClick={() => setDrawMode(false)}
            className="rounded-md px-3 py-1.5 text-xs text-text-muted hover:text-text"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface"
        style={{ cursor: drawMode ? 'crosshair' : 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={(e) => {
          handlePointerMove(e);
          handleZoneDrag(e);
        }}
        onPointerUp={() => {
          handlePointerUp();
          handleZoneDragEnd();
        }}
      >
        {/* Template image */}
        {templateImageUrl && (
          <img
            src={templateImageUrl}
            alt="Template"
            className="absolute inset-0 h-full w-full object-contain pointer-events-none"
            draggable={false}
          />
        )}

        {/* Drawing preview */}
        {isDrawing && drawStart && drawCurrent && (
          <div
            className="absolute border-2 border-dashed"
            style={{
              left: `${Math.min(drawStart.x, drawCurrent.x)}%`,
              top: `${Math.min(drawStart.y, drawCurrent.y)}%`,
              width: `${Math.abs(drawCurrent.x - drawStart.x)}%`,
              height: `${Math.abs(drawCurrent.y - drawStart.y)}%`,
              borderColor: ZONE_BORDER_COLORS[newZoneType],
              backgroundColor: ZONE_COLORS[newZoneType],
            }}
          />
        )}

        {/* Existing zones */}
        {zones.map((zone) => (
          <motion.div
            key={zone.id}
            className="absolute flex items-center justify-center border-2 text-xs font-medium"
            style={{
              left: `${zone.position.x - zone.position.width / 2}%`,
              top: `${zone.position.y - zone.position.height / 2}%`,
              width: `${zone.position.width}%`,
              height: `${zone.position.height}%`,
              borderColor: ZONE_BORDER_COLORS[zone.type],
              backgroundColor:
                selectedZoneId === zone.id
                  ? ZONE_COLORS[zone.type].replace('0.3', '0.5')
                  : ZONE_COLORS[zone.type],
              cursor: drawMode ? 'crosshair' : 'move',
              zIndex:
                selectedZoneId === zone.id
                  ? 10
                  : (zone.constraints as Record<string, number>).z_index ?? 1,
            }}
            onPointerDown={(e) => handleZoneDragStart(e, zone.id)}
            whileHover={{ opacity: 0.9 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="rounded bg-black/50 px-1.5 py-0.5 text-xs sm:text-[10px] text-white truncate max-w-full">
              {zone.label}
            </span>

            {/* Delete button */}
            {selectedZoneId === zone.id && (
              <button
                type="button"
                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white shadow-md hover:bg-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  removeZone(zone.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Zone list */}
      <div className="space-y-1">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-xs cursor-pointer transition-colors ${
              selectedZoneId === zone.id
                ? 'bg-primary/10 border border-primary'
                : 'bg-surface hover:bg-surface-hover'
            }`}
            onClick={() => onSelectZone(zone.id)}
          >
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: ZONE_BORDER_COLORS[zone.type] }}
              />
              <span className="font-medium text-text">{zone.label}</span>
              <span className="text-text-muted">({zone.type})</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeZone(zone.id);
              }}
              className="text-text-muted hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
