import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  X,
  AlertTriangle,
  Palette,
  Eye,
  Info,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// ── Types ────────────────────────────────────────────────────────

interface ColorEntry {
  hex: string;
  name: string;
  role: string;
}

interface ColorHarmonyValidatorProps {
  colors: ColorEntry[];
  onChange?: (updatedColors: ColorEntry[]) => void;
}

interface ContrastResult {
  colorA: ColorEntry;
  colorB: ColorEntry;
  ratio: number;
  passAA: boolean;
  passAAA: boolean;
}

interface ClashWarning {
  colorA: ColorEntry;
  colorB: ColorEntry;
  reason: string;
}

type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split-complementary'
  | 'monochromatic'
  | 'tetradic'
  | 'mixed';

interface HarmonyResult {
  type: HarmonyType;
  description: string;
  confidence: number;
}

// ── Color Utility Functions ──────────────────────────────────────

/** Parse a hex color string to { r, g, b } (0-255). */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/** Convert RGB (0-255) to HSL (h: 0-360, s: 0-100, l: 0-100). */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === rn) {
      h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60;
    } else if (max === gn) {
      h = ((bn - rn) / delta + 2) * 60;
    } else {
      h = ((rn - gn) / delta + 4) * 60;
    }
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/** Convert a hex color to HSL. */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

/**
 * Calculate relative luminance per WCAG 2.x spec.
 * Each sRGB channel is linearized then combined with coefficients.
 */
function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);

  const linearize = (c: number): number => {
    const srgb = c / 255;
    return srgb <= 0.04045
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Calculate WCAG contrast ratio between two colors. */
function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Get the smallest angular difference between two hues (0-180). */
function hueDifference(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2);
  return diff > 180 ? 360 - diff : diff;
}

// ── Analysis Functions ───────────────────────────────────────────

/** Analyze WCAG contrast for all text-on-background pairs. */
function analyzeContrast(colors: ColorEntry[]): ContrastResult[] {
  const results: ContrastResult[] = [];

  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const ratio = contrastRatio(colors[i].hex, colors[j].hex);
      results.push({
        colorA: colors[i],
        colorB: colors[j],
        ratio: Math.round(ratio * 100) / 100,
        passAA: ratio >= 4.5,
        passAAA: ratio >= 7,
      });
    }
  }

  return results.sort((a, b) => b.ratio - a.ratio);
}

/** Detect the color harmony type from HSL hue angles. */
function detectHarmony(colors: ColorEntry[]): HarmonyResult {
  if (colors.length < 2) {
    return {
      type: 'monochromatic',
      description: 'A single color or too few colors to determine harmony.',
      confidence: 1,
    };
  }

  const hslColors = colors.map((c) => hexToHsl(c.hex));
  const hues = hslColors.map((c) => c.h);
  const saturations = hslColors.map((c) => c.s);

  // Check monochromatic: all hues within 15 degrees
  const maxHueDiff = Math.max(
    ...hues.flatMap((h1, i) => hues.slice(i + 1).map((h2) => hueDifference(h1, h2))),
  );

  if (maxHueDiff <= 15 || saturations.every((s) => s < 10)) {
    return {
      type: 'monochromatic',
      description:
        'Colors share the same hue with variations in lightness and saturation. Creates a cohesive, unified feel.',
      confidence: 0.9,
    };
  }

  // For 2 colors
  if (colors.length === 2) {
    const diff = hueDifference(hues[0], hues[1]);
    if (diff >= 150 && diff <= 210) {
      return {
        type: 'complementary',
        description:
          'Colors sit opposite each other on the color wheel. Creates high contrast and visual energy.',
        confidence: 0.85,
      };
    }
    if (diff <= 60) {
      return {
        type: 'analogous',
        description:
          'Colors sit next to each other on the color wheel. Creates a harmonious, natural feel.',
        confidence: 0.8,
      };
    }
  }

  // For 3+ colors, check all pairwise hue differences
  const pairDiffs: number[] = [];
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      pairDiffs.push(hueDifference(hues[i], hues[j]));
    }
  }

  // Analogous: all pairs within 60 degrees
  if (pairDiffs.every((d) => d <= 60)) {
    return {
      type: 'analogous',
      description:
        'Colors sit near each other on the color wheel. Creates a harmonious, serene palette that feels natural and cohesive.',
      confidence: 0.85,
    };
  }

  // Triadic: three hues roughly 120 degrees apart
  if (colors.length >= 3) {
    const sorted = [...hues].sort((a, b) => a - b);
    const triadicCheck = sorted.every((h, i) => {
      const next = sorted[(i + 1) % sorted.length];
      const diff = hueDifference(h, next);
      return diff >= 90 && diff <= 150;
    });
    if (triadicCheck) {
      return {
        type: 'triadic',
        description:
          'Three colors evenly spaced around the color wheel. Offers vibrant variety while maintaining balance.',
        confidence: 0.75,
      };
    }
  }

  // Split-complementary: one base hue with two colors near its complement
  if (colors.length >= 3) {
    for (let base = 0; base < hues.length; base++) {
      const complementHue = (hues[base] + 180) % 360;
      const others = hues.filter((_, i) => i !== base);
      const nearComplement = others.filter((h) => hueDifference(h, complementHue) <= 45);
      if (nearComplement.length >= 2) {
        return {
          type: 'split-complementary',
          description:
            'A base color paired with the two colors adjacent to its complement. Provides contrast with less tension than direct complementary.',
          confidence: 0.7,
        };
      }
    }
  }

  // Complementary: at least one pair is near-complementary
  const hasComplement = pairDiffs.some((d) => d >= 150 && d <= 210);
  if (hasComplement) {
    return {
      type: 'complementary',
      description:
        'Palette includes complementary colors (opposite on the wheel). Creates bold contrast and visual interest.',
      confidence: 0.65,
    };
  }

  return {
    type: 'mixed',
    description:
      'A custom harmony that combines multiple color relationships. Can work well when balanced with intentional saturation and lightness choices.',
    confidence: 0.5,
  };
}

/** Detect clashing color combinations. */
function detectClashes(colors: ColorEntry[]): ClashWarning[] {
  const warnings: ClashWarning[] = [];
  const hslColors = colors.map((c) => ({ ...c, hsl: hexToHsl(c.hex) }));

  for (let i = 0; i < hslColors.length; i++) {
    for (let j = i + 1; j < hslColors.length; j++) {
      const a = hslColors[i];
      const b = hslColors[j];
      const hueDiff = hueDifference(a.hsl.h, b.hsl.h);

      // Hues within 30 degrees but different saturation/lightness creates a muddy clash
      if (
        hueDiff > 5 &&
        hueDiff <= 30 &&
        (Math.abs(a.hsl.s - b.hsl.s) > 30 || Math.abs(a.hsl.l - b.hsl.l) > 30)
      ) {
        warnings.push({
          colorA: colors[i],
          colorB: colors[j],
          reason: `Similar hues (${hueDiff}\u00B0 apart) with different saturation/lightness can appear muddy together.`,
        });
      }

      // Two highly saturated colors with awkward hue gap (35-65 degrees)
      if (
        hueDiff > 35 &&
        hueDiff < 65 &&
        a.hsl.s > 60 &&
        b.hsl.s > 60
      ) {
        warnings.push({
          colorA: colors[i],
          colorB: colors[j],
          reason: `Both are highly saturated with an awkward hue gap (${hueDiff}\u00B0). Consider adjusting saturation or choosing a wider angle.`,
        });
      }
    }
  }

  return warnings;
}

// ── Sub-Components ───────────────────────────────────────────────

function ColorSwatchRow({ colors }: { colors: ColorEntry[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {colors.map((color, i) => (
        <motion.div
          key={`${color.role}-${i}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="flex flex-col items-center gap-1.5"
        >
          <div
            className="h-14 w-14 rounded-xl border-2 border-border shadow-sm"
            style={{ backgroundColor: color.hex }}
            title={`${color.name} (${color.hex})`}
          />
          <span className="text-xs font-medium text-text">{color.name}</span>
          <span className="text-[10px] font-mono text-text-muted">{color.hex}</span>
        </motion.div>
      ))}
    </div>
  );
}

function ContrastBadge({ passAA, passAAA }: { passAA: boolean; passAAA: boolean }) {
  if (passAAA) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-bg border border-success-border px-2 py-0.5 text-xs font-medium text-success">
        <Check className="h-3 w-3" />
        AAA
      </span>
    );
  }
  if (passAA) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg border border-warning-border px-2 py-0.5 text-xs font-medium text-warning">
        <AlertTriangle className="h-3 w-3" />
        AA only
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-error-bg border border-error-border px-2 py-0.5 text-xs font-medium text-error">
      <X className="h-3 w-3" />
      Fail
    </span>
  );
}

function ContrastPairRow({ result }: { result: ContrastResult }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-hover/30 px-3 py-2">
      <div className="flex items-center gap-2">
        <div
          className="h-5 w-5 rounded border border-border/50"
          style={{ backgroundColor: result.colorA.hex }}
        />
        <span className="text-xs text-text-secondary">{result.colorA.name}</span>
        <span className="text-xs text-text-muted">/</span>
        <div
          className="h-5 w-5 rounded border border-border/50"
          style={{ backgroundColor: result.colorB.hex }}
        />
        <span className="text-xs text-text-secondary">{result.colorB.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-text-muted">{result.ratio}:1</span>
        <ContrastBadge passAA={result.passAA} passAAA={result.passAAA} />
      </div>
    </div>
  );
}

function HarmonyBadge({ type }: { type: HarmonyType }) {
  const labels: Record<HarmonyType, string> = {
    complementary: 'Complementary',
    analogous: 'Analogous',
    triadic: 'Triadic',
    'split-complementary': 'Split-Complementary',
    monochromatic: 'Monochromatic',
    tetradic: 'Tetradic',
    mixed: 'Custom Mix',
  };

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-sm font-semibold text-primary">
      <Palette className="h-3.5 w-3.5" />
      {labels[type]}
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────────

export function ColorHarmonyValidator({ colors }: ColorHarmonyValidatorProps) {
  const contrastResults = useMemo(() => analyzeContrast(colors), [colors]);
  const harmony = useMemo(() => detectHarmony(colors), [colors]);
  const clashes = useMemo(() => detectClashes(colors), [colors]);

  const passCount = contrastResults.filter((r) => r.passAA).length;
  const totalPairs = contrastResults.length;

  if (colors.length < 2) {
    return (
      <Card variant="outlined" padding="md">
        <div className="flex items-center gap-2 text-text-muted">
          <Info className="h-4 w-4" />
          <p className="text-sm">Add at least two colors to analyze harmony and contrast.</p>
        </div>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Color Swatches */}
      <Card variant="default" padding="md">
        <CardHeader>
          <CardTitle>Color Palette</CardTitle>
        </CardHeader>
        <CardContent>
          <ColorSwatchRow colors={colors} />
        </CardContent>
      </Card>

      {/* Harmony Analysis */}
      <Card variant="default" padding="md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Harmony Analysis</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <HarmonyBadge type={harmony.type} />
              <span className="text-xs text-text-muted">
                {Math.round(harmony.confidence * 100)}% confidence
              </span>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">
              {harmony.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* WCAG Contrast Check */}
      <Card variant="default" padding="md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <CardTitle>WCAG Contrast Check</CardTitle>
          </div>
          <span className="text-xs text-text-muted">
            {passCount}/{totalPairs} pairs pass AA
          </span>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {contrastResults.map((result, i) => (
              <motion.div
                key={`${result.colorA.hex}-${result.colorB.hex}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
              >
                <ContrastPairRow result={result} />
              </motion.div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-hover/50 px-3 py-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
            <p className="text-xs text-text-muted">
              WCAG AA requires 4.5:1 for normal text. AAA requires 7:1.
              Large text (18px+ bold or 24px+) needs only 3:1 for AA.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Clash Warnings */}
      {clashes.length > 0 && (
        <Card variant="outlined" padding="md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <CardTitle>Clash Warnings</CardTitle>
            </div>
            <span className="text-xs text-warning">
              {clashes.length} potential {clashes.length === 1 ? 'issue' : 'issues'}
            </span>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {clashes.map((clash, i) => (
                <motion.div
                  key={`clash-${clash.colorA.hex}-${clash.colorB.hex}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.25 }}
                  className="flex items-start gap-3 rounded-lg border border-warning-border bg-warning-bg/50 px-3 py-2.5"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div>
                    <p className="text-sm font-medium text-text">
                      Potential clash between{' '}
                      <span className="font-semibold">{clash.colorA.name}</span> and{' '}
                      <span className="font-semibold">{clash.colorB.name}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">{clash.reason}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All clear message when no clashes */}
      {clashes.length === 0 && (
        <Card variant="outlined" padding="md">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-success" />
            <p className="text-sm font-medium text-success">
              No color clashes detected. Your palette looks harmonious!
            </p>
          </div>
        </Card>
      )}
    </motion.div>
  );
}
