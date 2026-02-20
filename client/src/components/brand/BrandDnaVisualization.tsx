import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Dna } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────

interface BrandDnaVisualizationProps {
  archetype: string;
  values: string[];
  colorPalette: Array<{ hex: string; name: string; role: string }>;
  targetAudience?: string | null;
  brandName?: string | null;
}

// ── Geometry Helpers ─────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

/** Parse audience text into discrete segments. */
function parseAudienceSegments(audience: string | null | undefined): string[] {
  if (!audience) return [];
  // Split on commas, semicolons, "and", or common delimiters
  const parts = audience
    .split(/[,;]|\band\b/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 40);
  return parts.slice(0, 4);
}

// ── Main Component ───────────────────────────────────────────────

export function BrandDnaVisualization({
  archetype,
  values,
  colorPalette,
  targetAudience,
  brandName,
}: BrandDnaVisualizationProps) {
  const cx = 200;
  const cy = 200;
  const size = 400;

  const audienceSegments = useMemo(
    () => parseAudienceSegments(targetAudience),
    [targetAudience],
  );

  // Color ring positions (inner ring, radius ~85)
  const colorRingRadius = 85;
  const colorPositions = useMemo(
    () =>
      colorPalette.slice(0, 6).map((_, i, arr) => {
        const angle = (360 / arr.length) * i;
        return polarToCartesian(cx, cy, colorRingRadius, angle);
      }),
    [colorPalette],
  );

  // Values positions (mid ring, radius ~135)
  const valuesRadius = 135;
  const valuePositions = useMemo(
    () =>
      values.slice(0, 6).map((_, i, arr) => {
        const angle = (360 / arr.length) * i;
        return polarToCartesian(cx, cy, valuesRadius, angle);
      }),
    [values],
  );

  // Audience nodes (outer ring, radius ~180)
  const audienceRadius = 178;
  const audiencePositions = useMemo(
    () =>
      audienceSegments.map((_, i, arr) => {
        const angle = (360 / arr.length) * i + 45; // offset so they don't overlap values
        return polarToCartesian(cx, cy, audienceRadius, angle);
      }),
    [audienceSegments],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-border bg-surface p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Dna className="h-5 w-5 text-accent" />
        <h3 className="text-base font-bold text-text">Brand DNA</h3>
      </div>
      <p className="mb-4 text-xs text-text-muted">
        Your brand identity at a glance -- archetype at center, values radiating out, color rings, and audience segments.
      </p>

      <div className="mx-auto" style={{ maxWidth: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Brand DNA diagram for ${brandName || 'your brand'}`}
        >
          {/* Outer reference circles (faint) */}
          <circle cx={cx} cy={cy} r={audienceRadius} fill="none" stroke="var(--bmn-border)" strokeWidth="0.5" strokeDasharray="4 4" opacity={0.4} />
          <circle cx={cx} cy={cy} r={valuesRadius} fill="none" stroke="var(--bmn-border)" strokeWidth="0.5" strokeDasharray="4 4" opacity={0.3} />
          <circle cx={cx} cy={cy} r={colorRingRadius} fill="none" stroke="var(--bmn-border)" strokeWidth="0.5" strokeDasharray="4 4" opacity={0.2} />

          {/* Connecting lines: archetype center to values */}
          {valuePositions.map((pos, i) => (
            <motion.line
              key={`val-line-${i}`}
              x1={cx}
              y1={cy}
              x2={pos.x}
              y2={pos.y}
              stroke="var(--bmn-border)"
              strokeWidth="1"
              opacity={0.3}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
            />
          ))}

          {/* Color ring swatches */}
          {colorPalette.slice(0, 6).map((color, i) => {
            const pos = colorPositions[i];
            return (
              <motion.g key={`color-${i}`}>
                <motion.circle
                  cx={pos.x}
                  cy={pos.y}
                  r={14}
                  fill={color.hex}
                  stroke="#fff"
                  strokeWidth="2"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4 + i * 0.08, type: 'spring', stiffness: 200 }}
                />
                <title>{`${color.name} (${color.hex})`}</title>
              </motion.g>
            );
          })}

          {/* Values nodes */}
          {values.slice(0, 6).map((value, i) => {
            const pos = valuePositions[i];
            const primaryColor = colorPalette[0]?.hex || '#6366f1';
            return (
              <motion.g key={`value-${i}`}>
                <motion.rect
                  x={pos.x - 40}
                  y={pos.y - 12}
                  width={80}
                  height={24}
                  rx={12}
                  fill="var(--bmn-surface-hover, #f3f4f6)"
                  stroke={primaryColor}
                  strokeWidth="1.5"
                  opacity={0.9}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.9 }}
                  transition={{ delay: 0.6 + i * 0.1, type: 'spring', stiffness: 180 }}
                />
                <motion.text
                  x={pos.x}
                  y={pos.y + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="var(--bmn-text, #111)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                >
                  {value.length > 12 ? value.slice(0, 11) + '...' : value}
                </motion.text>
              </motion.g>
            );
          })}

          {/* Audience nodes (outer ring) */}
          {audienceSegments.map((segment, i) => {
            const pos = audiencePositions[i];
            const accentColor = colorPalette[2]?.hex || '#10b981';
            return (
              <motion.g key={`audience-${i}`}>
                <motion.rect
                  x={pos.x - 42}
                  y={pos.y - 10}
                  width={84}
                  height={20}
                  rx={10}
                  fill="var(--bmn-surface, #fff)"
                  stroke={accentColor}
                  strokeWidth="1"
                  strokeDasharray="3 2"
                  opacity={0.8}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.8 }}
                  transition={{ delay: 1.0 + i * 0.12, type: 'spring', stiffness: 150 }}
                />
                <motion.text
                  x={pos.x}
                  y={pos.y + 3}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="500"
                  fill="var(--bmn-text-secondary, #555)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.1 + i * 0.12 }}
                >
                  {segment.length > 14 ? segment.slice(0, 13) + '...' : segment}
                </motion.text>
              </motion.g>
            );
          })}

          {/* Center archetype circle */}
          <motion.circle
            cx={cx}
            cy={cy}
            r={38}
            fill={colorPalette[0]?.hex || '#6366f1'}
            opacity={0.15}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 120, delay: 0.1 }}
          />
          <motion.circle
            cx={cx}
            cy={cy}
            r={32}
            fill={colorPalette[0]?.hex || '#6366f1'}
            opacity={0.9}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 150, delay: 0.15 }}
          />
          <motion.text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill="#fff"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {archetype}
          </motion.text>
          {brandName && (
            <motion.text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              fontSize="7"
              fontWeight="400"
              fill="rgba(255,255,255,0.8)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              {brandName.length > 18 ? brandName.slice(0, 17) + '...' : brandName}
            </motion.text>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colorPalette[0]?.hex || '#6366f1' }} />
          <span>Archetype</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-md border border-border bg-surface-hover" />
          <span>Values</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full border-2" style={{ borderColor: colorPalette[0]?.hex || '#6366f1' }} />
          <span>Colors</span>
        </div>
        {audienceSegments.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-md border border-dashed" style={{ borderColor: colorPalette[2]?.hex || '#10b981' }} />
            <span>Audience</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
