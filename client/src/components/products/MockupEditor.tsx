import { useState, useRef, useCallback, useEffect, type PointerEvent } from 'react';
import { motion } from 'motion/react';
import { Move, ZoomIn, ZoomOut, RotateCcw, Eye, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LogoPosition {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

interface MockupEditorProps {
  mockupUrl: string;
  logoUrl: string;
  productName: string;
  onSave?: (position: LogoPosition) => void;
  className?: string;
}

const DEFAULT_POSITION: LogoPosition = {
  x: 50,
  y: 40,
  scale: 0.3,
  opacity: 1.0,
};

const COLOR_PRESETS = [
  { name: 'White', bg: '#FFFFFF' },
  { name: 'Black', bg: '#000000' },
  { name: 'Navy', bg: '#1B2A4A' },
  { name: 'Forest', bg: '#1A3C2F' },
  { name: 'Burgundy', bg: '#6B1D3D' },
  { name: 'Slate', bg: '#475569' },
];

export function MockupEditor({
  mockupUrl,
  logoUrl,
  productName,
  onSave,
  className,
}: MockupEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<LogoPosition>(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [labelColor, setLabelColor] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const logoX = (position.x / 100) * rect.width;
    const logoY = (position.y / 100) * rect.height;

    dragOffset.current = {
      x: e.clientX - rect.left - logoX,
      y: e.clientY - rect.top - logoY,
    };

    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position.x, position.y]);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left - dragOffset.current.x) / rect.width) * 100;
    const y = ((e.clientY - rect.top - dragOffset.current.y) / rect.height) * 100;

    setPosition((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    }));
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const adjustScale = (delta: number) => {
    setPosition((prev) => ({
      ...prev,
      scale: Math.max(0.1, Math.min(1.0, prev.scale + delta)),
    }));
  };

  const adjustOpacity = (delta: number) => {
    setPosition((prev) => ({
      ...prev,
      opacity: Math.max(0.1, Math.min(1.0, prev.opacity + delta)),
    }));
  };

  const handleReset = () => {
    setPosition(DEFAULT_POSITION);
    setLabelColor(null);
  };

  const handleSave = () => {
    onSave?.(position);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">{productName}</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowPreview(!showPreview)}
            title={showPreview ? 'Edit mode' : 'Preview mode'}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleReset} title="Reset position">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={cn(
          'relative aspect-square overflow-hidden rounded-xl border-2 bg-surface-hover',
          isDragging ? 'border-primary cursor-grabbing' : 'border-border cursor-crosshair',
        )}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Mockup background */}
        <img
          src={mockupUrl}
          alt={`${productName} mockup`}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {/* Label background color overlay */}
        {labelColor && (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: labelColor, opacity: 0.15 }}
          />
        )}

        {/* Draggable logo */}
        {!showPreview && (
          <div className="absolute inset-0 bg-black/10" />
        )}

        <div
          onPointerDown={handlePointerDown}
          className={cn(
            'absolute -translate-x-1/2 -translate-y-1/2 transition-shadow',
            isDragging ? 'shadow-2xl' : 'shadow-lg',
            !showPreview && 'ring-2 ring-primary/50 ring-dashed rounded-sm',
          )}
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: `${position.scale * 100}%`,
            opacity: position.opacity,
          }}
        >
          <img
            src={logoUrl}
            alt="Your logo"
            className="h-auto w-full"
            draggable={false}
          />
          {!showPreview && (
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-white">
              <Move className="mr-1 inline h-2.5 w-2.5" />
              Drag to move
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      {!showPreview && (
        <div className="space-y-3">
          {/* Scale control */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-xs text-text-muted">Size</span>
            <Button variant="ghost" size="icon" onClick={() => adjustScale(-0.05)}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <input
              type="range"
              min="10"
              max="100"
              value={Math.round(position.scale * 100)}
              onChange={(e) =>
                setPosition((prev) => ({ ...prev, scale: parseInt(e.target.value) / 100 }))
              }
              className="h-1.5 flex-1 appearance-none rounded-full bg-surface-hover accent-primary"
            />
            <Button variant="ghost" size="icon" onClick={() => adjustScale(0.05)}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <span className="w-10 text-right text-xs text-text-muted">
              {Math.round(position.scale * 100)}%
            </span>
          </div>

          {/* Opacity control */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-xs text-text-muted">Opacity</span>
            <div className="h-4 w-4" />
            <input
              type="range"
              min="10"
              max="100"
              value={Math.round(position.opacity * 100)}
              onChange={(e) =>
                setPosition((prev) => ({ ...prev, opacity: parseInt(e.target.value) / 100 }))
              }
              className="h-1.5 flex-1 appearance-none rounded-full bg-surface-hover accent-primary"
            />
            <div className="h-4 w-4" />
            <span className="w-10 text-right text-xs text-text-muted">
              {Math.round(position.opacity * 100)}%
            </span>
          </div>

          {/* Color variants */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-xs text-text-muted">
              <Palette className="inline h-3 w-3" /> Color
            </span>
            <div className="flex gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setLabelColor(preset.bg === labelColor ? null : preset.bg)}
                  title={preset.name}
                  className={cn(
                    'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                    labelColor === preset.bg ? 'border-primary scale-110' : 'border-border',
                  )}
                  style={{ backgroundColor: preset.bg }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Save button */}
      {onSave && (
        <Button onClick={handleSave} fullWidth>
          Save Mockup Position
        </Button>
      )}
    </div>
  );
}
