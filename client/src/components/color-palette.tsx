import { useState } from 'react';
import { Check, Pipette, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

// ------ Types ------

export interface ColorEntry {
  hex: string;
  name: string;
  role: 'primary' | 'secondary' | 'accent' | 'background' | 'text' | 'custom';
}

interface ColorPaletteProps {
  colors: ColorEntry[];
  onChange?: (colors: ColorEntry[]) => void;
  editable?: boolean;
  className?: string;
}

interface ColorSwatchProps {
  color: ColorEntry;
  selected?: boolean;
  editable?: boolean;
  onSelect?: () => void;
  onColorChange?: (hex: string) => void;
  onRemove?: () => void;
}

// ------ Color Swatch ------

function ColorSwatch({
  color,
  selected = false,
  editable = false,
  onSelect,
  onColorChange,
  onRemove,
}: ColorSwatchProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(color.hex);

  const handleSave = () => {
    const hex = inputValue.startsWith('#') ? inputValue : `#${inputValue}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onColorChange?.(hex);
    }
    setEditing(false);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'relative h-16 w-16 rounded-xl border-2 transition-all duration-200 hover:scale-105',
          selected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
        )}
        style={{ backgroundColor: color.hex }}
        title={`${color.name} (${color.hex})`}
      >
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Check className="h-5 w-5 text-white drop-shadow-md" />
          </div>
        )}
        {editable && onRemove && color.role === 'custom' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-error text-white"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </button>

      {editing ? (
        <div className="flex items-center gap-1">
          <input
            type="color"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              onColorChange?.(e.target.value);
            }}
            className="h-6 w-6 cursor-pointer rounded border-0"
          />
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="h-6 w-20 px-1 text-xs"
          />
        </div>
      ) : (
        <div className="text-center">
          <p className="text-xs font-medium text-text">{color.name}</p>
          <button
            type="button"
            onClick={() => editable && setEditing(true)}
            className={cn(
              'text-xs text-text-muted',
              editable && 'cursor-pointer hover:text-primary',
            )}
          >
            {color.hex}
          </button>
        </div>
      )}
    </div>
  );
}

// ------ Color Palette ------

function ColorPalette({ colors, onChange, editable = false, className }: ColorPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleColorChange = (index: number, hex: string) => {
    if (!onChange) return;
    const updated = colors.map((c, i) => (i === index ? { ...c, hex } : c));
    onChange(updated);
  };

  const handleRemoveColor = (index: number) => {
    if (!onChange) return;
    onChange(colors.filter((_, i) => i !== index));
  };

  const handleAddColor = () => {
    if (!onChange) return;
    onChange([
      ...colors,
      { hex: '#6366f1', name: 'Custom', role: 'custom' },
    ]);
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center gap-4">
        {colors.map((color, index) => (
          <ColorSwatch
            key={`${color.role}-${index}`}
            color={color}
            selected={selectedIndex === index}
            editable={editable}
            onSelect={() => setSelectedIndex(selectedIndex === index ? null : index)}
            onColorChange={(hex) => handleColorChange(index, hex)}
            onRemove={() => handleRemoveColor(index)}
          />
        ))}

        {editable && colors.length < 8 && (
          <button
            type="button"
            onClick={handleAddColor}
            className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-border text-text-muted transition-colors hover:border-primary hover:text-primary"
          >
            <Pipette className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Gradient preview */}
      {colors.length >= 2 && (
        <div
          className="h-8 w-full rounded-lg"
          style={{
            background: `linear-gradient(to right, ${colors.map((c) => c.hex).join(', ')})`,
          }}
        />
      )}
    </div>
  );
}

export { ColorPalette, ColorSwatch };
