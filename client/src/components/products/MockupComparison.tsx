import { useState, useRef, useCallback, type PointerEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MockupComparisonProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

export function MockupComparison({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Before',
  afterLabel = 'Your Brand',
  className,
}: MockupComparisonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const updatePosition = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.max(5, Math.min(95, x)));
  }, []);

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  }, [updatePosition]);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updatePosition(e.clientX);
  }, [isDragging, updatePosition]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className={cn('space-y-2', className)}>
      <div
        ref={containerRef}
        className="relative aspect-square cursor-col-resize overflow-hidden rounded-xl border-2 border-border"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* After image (full width, underneath) */}
        <img
          src={afterUrl}
          alt={afterLabel}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {/* Before image (clipped) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={beforeUrl}
            alt={beforeLabel}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ width: containerRef.current?.offsetWidth || '100%' }}
            draggable={false}
          />
        </div>

        {/* Slider line */}
        <div
          className="absolute top-0 bottom-0 z-10 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]"
          style={{ left: `${sliderPosition}%` }}
        >
          {/* Drag handle */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              animate={{ scale: isDragging ? 1.15 : 1 }}
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-lg"
            >
              <ArrowLeftRight className="h-5 w-5" />
            </motion.div>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {beforeLabel}
        </div>
        <div className="absolute bottom-3 right-3 rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {afterLabel}
        </div>
      </div>

      <p className="text-center text-xs text-text-muted">
        Drag the slider to compare the raw product with your branded version
      </p>
    </div>
  );
}
