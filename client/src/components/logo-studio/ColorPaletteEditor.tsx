import { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColorPaletteEditorProps {
  colors: string[];
  onChange: (colors: string[]) => void;
  maxColors?: number;
  disabled?: boolean;
}

export function ColorPaletteEditor({
  colors,
  onChange,
  maxColors = 8,
  disabled,
}: ColorPaletteEditorProps) {
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleColorChange = (index: number, newColor: string) => {
    const updated = [...colors];
    updated[index] = newColor;
    onChange(updated);
  };

  const addColor = () => {
    if (colors.length < maxColors) {
      onChange([...colors, '#6366F1']);
    }
  };

  const removeColor = (index: number) => {
    if (colors.length <= 1) return;
    onChange(colors.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
        Color Palette
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <AnimatePresence mode="popLayout">
          {colors.map((color, i) => (
            <motion.div
              key={i}
              layout
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="group relative"
            >
              <button
                onClick={() => inputRefs.current[i]?.click()}
                disabled={disabled}
                className={cn(
                  'h-9 w-9 rounded-lg border-2 border-white/20 shadow-sm transition-transform hover:scale-110',
                  disabled && 'cursor-not-allowed',
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
              <input
                ref={(el) => { inputRefs.current[i] = el; }}
                type="color"
                value={color}
                onChange={(e) => handleColorChange(i, e.target.value)}
                className="sr-only"
              />
              {!disabled && colors.length > 1 && (
                <button
                  onClick={() => removeColor(i)}
                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-error text-white text-[10px] group-hover:flex"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {colors.length < maxColors && !disabled && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={addColor}
            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-dashed border-border/50 text-text-muted hover:border-border hover:text-text-secondary transition-colors"
          >
            <Plus className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
