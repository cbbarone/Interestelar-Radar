import { useState, useMemo, useCallback, useRef } from "react";
import cceeLogo from "@assets/ccee_gein_nobg.png";
import {
  visibleProjects,
  ACTIVE_CATEGORIES,
  STAGES,
  getCategoryColor,
  getStageRing,
  type Project,
  type Category,
} from "@/data/projects";

// ─── Inner radar constants ───────────────────────────────────────────────────
const NUM_RINGS = 6; // only rings 0–5 after filtering
const RADAR_SIZE = 1100;
const CX = RADAR_SIZE / 2;         // 550
const CY = RADAR_SIZE / 2;         // 550
const CENTER_R = 90;               // central logo ring — no projects enter here
const MIN_R = 108;
const MAX_R = 420;
const RING_STEP = (MAX_R - MIN_R) / (NUM_RINGS - 1);
const DOT_R = 5;
const MIN_SPACING = DOT_R * 2 + 3; // 13px
const ANG_MARGIN_FRAC = 0.07;

// ─── Outer proportional ring constants ──────────────────────────────────────
const OUTER_R = 490;               // radius of the outer dot ring
const OUTER_TICK_R = OUTER_R + 18; // label placement radius
const START_OFFSET = -Math.PI / 2;
const NUM_CATEGORIES = ACTIVE_CATEGORIES.length;
const SECTOR_ANGLE = (2 * Math.PI) / NUM_CATEGORIES;

function ringRadius(ring: number): number {
  return MIN_R + ring * RING_STEP;
}

function polarToXY(angle: number, radius: number, cx = CX, cy = CY) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function sectorPath(
  startAngle: number,
  endAngle: number,
  innerR: number,
  outerR: number
): string {
  const s1 = polarToXY(startAngle, innerR);
  const s2 = polarToXY(startAngle, outerR);
  const e1 = polarToXY(endAngle, innerR);
  const e2 = polarToXY(endAngle, outerR);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${s1.x} ${s1.y}`,
    `L ${s2.x} ${s2.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${e2.x} ${e2.y}`,
    `L ${e1.x} ${e1.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${s1.x} ${s1.y}`,
    "Z",
  ].join(" ");
}

// ─── Outer ring proportional layout ──────────────────────────────────────────
interface OuterSector {
  catKey: string;
  color: string;
  label: string;
  startAngle: number;
  endAngle: number;
  count: number;
}

function computeOuterSectors(): OuterSector[] {
  const total = visibleProjects.length;
  const sectors: OuterSector[] = [];
  let cursor = START_OFFSET;

  for (const cat of ACTIVE_CATEGORIES) {
    const count = visibleProjects.filter((p) => p.category === cat.key).length;
    const span = (count / total) * 2 * Math.PI;
    sectors.push({
      catKey: cat.key,
      color: cat.color,
      label: cat.label,
      startAngle: cursor,
      endAngle: cursor + span,
      count,
    });
    cursor += span;
  }
  return sectors;
}

// ─── Placement ───────────────────────────────────────────────────────────────
export interface PlacedProject extends Project {
  px: number;
  py: number;
  ring: number;
  sectorIndex: number;
  outerX: number;
  outerY: number;
  outerAngle: number;
}

function placeProjects(outerSectors: OuterSector[]): PlacedProject[] {
  // ── Step 1: Outer ring — evenly spaced within each proportional sector ────
  // Assigns each project a unique angle so outer dots never overlap.
  const outerMap = new Map<string, { outerX: number; outerY: number; outerAngle: number }>();

  for (const sector of outerSectors) {
    const sectorProjects = visibleProjects.filter((p) => p.category === sector.catKey);
    const n = sectorProjects.length;
    const span = sector.endAngle - sector.startAngle;

    sectorProjects.forEach((p, i) => {
      const margin = n > 1 ? span * 0.02 : 0;
      const angle =
        n === 1
          ? sector.startAngle + span / 2
          : sector.startAngle + margin + (i / (n - 1)) * (span - margin * 2);
      const { x, y } = polarToXY(angle, OUTER_R);
      outerMap.set(p.id, { outerX: x, outerY: y, outerAngle: angle });
    });
  }

  // ── Step 2: Inner ring — radially aligned with the outer dot ─────────────
  // Each project's inner dot sits at the SAME angle as its outer dot, at the
  // midpoint radius of its maturity ring band. Because outer dots have unique
  // angles, inner dots also have unique angles → no inner-to-inner overlaps.
  const innerMap = new Map<string, { px: number; py: number; ring: number; sectorIndex: number }>();

  for (const p of visibleProjects) {
    const outer = outerMap.get(p.id);
    if (!outer) continue;
    const ring = getStageRing(p.stage);
    const catIdx = ACTIVE_CATEGORIES.findIndex((c) => c.key === p.category);

    const bandInner = ring === 0 ? MIN_R * 0.25 : ringRadius(ring - 1) + DOT_R + 3;
    const bandOuter = ringRadius(ring) - DOT_R - 3;
    const midR = (bandInner + bandOuter) / 2;

    const { x, y } = polarToXY(outer.outerAngle, midR);
    innerMap.set(p.id, { px: x, py: y, ring, sectorIndex: catIdx });
  }

  // ── Combine ──────────────────────────────────────────────────────────────
  const placed: PlacedProject[] = [];
  for (const p of visibleProjects) {
    const inner = innerMap.get(p.id);
    const outer = outerMap.get(p.id);
    if (!inner || !outer) continue;
    placed.push({ ...p, ...inner, ...outer });
  }
  return placed;
}

// ─── Ring label info (rings 0–5 only; 6 and 7 are filtered out) ──────────────
const RING_LABEL_INFO = [
  { short: "Concluído" },
  { short: "Sol. experimentada" },
  { short: "Em experimentação" },
  { short: "Em definição" },
  { short: "Em aprofundamento" },
  { short: "Gerar ideias" },
];

// ─── Component ────────────────────────────────────────────────────────────────
interface TooltipState {
  project: PlacedProject;
  svgX: number;
  svgY: number;
}

interface BucketKey {
  catIdx: number;
  ring: number;
}

interface Props {
  activeCategories: Set<Category>;
  onProjectClick: (p: PlacedProject) => void;
  onBucketClick: (ps: PlacedProject[], catIdx: number, ring: number) => void;
}

export function RadarChart({ activeCategories, onProjectClick, onBucketClick }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [highlightBucket, setHighlightBucket] = useState<BucketKey | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const outerSectors = useMemo(() => computeOuterSectors(), []);
  const placed = useMemo(() => placeProjects(outerSectors), [outerSectors]);

  const bucketMap = useMemo(() => {
    const map = new Map<string, PlacedProject[]>();
    for (const p of placed) {
      const k = `${p.sectorIndex}-${p.ring}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return map;
  }, [placed]);

  const handleDotMouseEnter = useCallback(
    (e: React.MouseEvent<SVGCircleElement>, p: PlacedProject) => {
      const svg = svgRef.current;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      setTooltip({ project: p, svgX: svgPt.x, svgY: svgPt.y });
      setHoveredId(p.id);
    },
    []
  );

  const handleDotMouseLeave = useCallback(() => {
    setTooltip(null);
    setHoveredId(null);
  }, []);

  const handleDotClick = useCallback(
    (e: React.MouseEvent, p: PlacedProject) => {
      e.stopPropagation();
      onProjectClick(p);
    },
    [onProjectClick]
  );

  const handleSectorRingClick = useCallback(
    (e: React.MouseEvent<SVGElement>, catIdx: number) => {
      if (!svgRef.current) return;
      const svg = svgRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      const dx = svgPt.x - CX;
      const dy = svgPt.y - CY;
      const clickR = Math.sqrt(dx * dx + dy * dy);
      let ring = NUM_RINGS - 1;
      for (let r = 0; r < NUM_RINGS; r++) {
        if (clickR <= ringRadius(r)) {
          ring = r;
          break;
        }
      }
      const key = `${catIdx}-${ring}`;
      const ps = bucketMap.get(key) ?? [];
      if (ps.length > 0) {
        setHighlightBucket({ catIdx, ring });
        onBucketClick(ps, catIdx, ring);
      }
    },
    [bucketMap, onBucketClick]
  );

  // Highlight dots when a sector in the outer ring is clicked
  const handleOuterSectorClick = useCallback(
    (e: React.MouseEvent, sector: OuterSector) => {
      e.stopPropagation();
      const catIdx = ACTIVE_CATEGORIES.findIndex((c) => c.key === sector.catKey);
      const catProjects = placed.filter((p) => p.category === sector.catKey);
      if (catProjects.length > 0) {
        onBucketClick(catProjects, catIdx, -1);
      }
    },
    [placed, onBucketClick]
  );

  return (
    <div className="relative w-full select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
        className="w-full h-full"
        style={{ maxHeight: "84vh" }}
      >
        <defs>
          <filter id="glow-strong">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-soft">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="bg-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(220,60%,10%)" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(225,39%,4%)" stopOpacity="1" />
          </radialGradient>
          <clipPath id="radar-clip">
            <circle cx={CX} cy={CY} r={MAX_R + 4} />
          </clipPath>
        </defs>

        {/* Dark background covering entire SVG */}
        <rect x="0" y="0" width={RADAR_SIZE} height={RADAR_SIZE} fill="hsl(225,39%,3%)" />

        {/* Inner radar background */}
        <circle cx={CX} cy={CY} r={MAX_R + 4} fill="url(#bg-gradient)" />

        {/* ── Inner sector fills (same proportional angles as outer ring) ── */}
        {outerSectors.map((sector, i) => {
          const cat = ACTIVE_CATEGORIES[i];
          const isActive = activeCategories.has(cat.key);
          const isHighlighted =
            highlightBucket !== null && highlightBucket.catIdx === i;
          return (
            <path
              key={cat.key}
              d={sectorPath(sector.startAngle, sector.endAngle, CENTER_R, MAX_R + 4)}
              fill={isActive ? cat.color : "#444"}
              fillOpacity={isHighlighted ? 0.14 : isActive ? 0.065 : 0.018}
              clipPath="url(#radar-clip)"
              style={{ cursor: "pointer" }}
              onClick={(e) => handleSectorRingClick(e, i)}
            />
          );
        })}

        {/* ── Ring circles ── */}
        {Array.from({ length: NUM_RINGS }, (_, i) => (
          <circle
            key={i}
            cx={CX}
            cy={CY}
            r={ringRadius(i)}
            fill="none"
            stroke="rgba(120,160,255,0.12)"
            strokeWidth={1}
            strokeDasharray={i === NUM_RINGS - 1 ? "6 4" : undefined}
            style={{ pointerEvents: "none" }}
          />
        ))}

        {/* ── Inner sector dividers (aligned with proportional outer ring) ── */}
        {outerSectors.map((sector, i) => {
          const inner = polarToXY(sector.startAngle, CENTER_R);
          const outer = polarToXY(sector.startAngle, MAX_R + 4);
          return (
            <line
              key={i}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(120,160,255,0.18)"
              strokeWidth="1"
              style={{ pointerEvents: "none" }}
            />
          );
        })}

        {/* ── Ring labels ── */}
        {Array.from({ length: NUM_RINGS }, (_, i) => {
          const r = ringRadius(i);
          const angle = START_OFFSET + 0.035;
          const { x, y } = polarToXY(angle, r - 7);
          return (
            <text
              key={i}
              x={x}
              y={y}
              fontSize="9"
              fill="rgba(120,160,255,0.38)"
              fontFamily="Inter, system-ui, sans-serif"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ pointerEvents: "none" }}
            >
              {RING_LABEL_INFO[i]?.short}
            </text>
          );
        })}

        {/* ── Central logo ring ── */}
        {/* Solid dark fill so logo sits on clean background */}
        <circle cx={CX} cy={CY} r={CENTER_R} fill="hsl(225,39%,4%)" style={{ pointerEvents: "none" }} />
        {/* Subtle border ring */}
        <circle
          cx={CX} cy={CY} r={CENTER_R}
          fill="none"
          stroke="rgba(120,160,255,0.22)"
          strokeWidth="1.5"
          style={{ pointerEvents: "none" }}
        />
        {/* CCEE GEIN logo */}
        <image
          href={cceeLogo}
          x={CX - CENTER_R * 0.78}
          y={CY - CENTER_R * 0.78}
          width={CENTER_R * 1.56}
          height={CENTER_R * 1.56}
          style={{ pointerEvents: "none" }}
        />

        {/* ═══════════════════════════════════════════════════════════════════
            OUTER PROPORTIONAL RING
        ════════════════════════════════════════════════════════════════════ */}

        {/* Outer ring track */}
        <circle
          cx={CX}
          cy={CY}
          r={OUTER_R}
          fill="none"
          stroke="rgba(120,160,255,0.06)"
          strokeWidth="28"
          style={{ pointerEvents: "none" }}
        />

        {/* Outer sector arcs (colored stripes) */}
        {outerSectors.map((sector) => {
          const isActive = activeCategories.has(sector.catKey as Category);
          const arcAngle = sector.endAngle - sector.startAngle;
          // SVG arc for the outer ring stripe
          const s = polarToXY(sector.startAngle, OUTER_R - 12);
          const e = polarToXY(sector.endAngle - 0.004, OUTER_R - 12);
          const largeArc = arcAngle > Math.PI ? 1 : 0;
          const outerArcR = OUTER_R + 12;
          const innerArcR = OUTER_R - 12;

          const path = [
            `M ${polarToXY(sector.startAngle, innerArcR).x} ${polarToXY(sector.startAngle, innerArcR).y}`,
            `L ${polarToXY(sector.startAngle, outerArcR).x} ${polarToXY(sector.startAngle, outerArcR).y}`,
            `A ${outerArcR} ${outerArcR} 0 ${largeArc} 1 ${polarToXY(sector.endAngle - 0.002, outerArcR).x} ${polarToXY(sector.endAngle - 0.002, outerArcR).y}`,
            `L ${polarToXY(sector.endAngle - 0.002, innerArcR).x} ${polarToXY(sector.endAngle - 0.002, innerArcR).y}`,
            `A ${innerArcR} ${innerArcR} 0 ${largeArc} 0 ${polarToXY(sector.startAngle, innerArcR).x} ${polarToXY(sector.startAngle, innerArcR).y}`,
            "Z",
          ].join(" ");

          return (
            <path
              key={sector.catKey}
              d={path}
              fill={sector.color}
              fillOpacity={isActive ? 0.12 : 0.025}
              style={{ cursor: "pointer", transition: "fill-opacity 0.2s" }}
              onClick={(e) => handleOuterSectorClick(e, sector)}
            />
          );
        })}

        {/* Outer sector boundary ticks */}
        {outerSectors.map((sector) => {
          const inner = polarToXY(sector.startAngle, OUTER_R - 16);
          const outer = polarToXY(sector.startAngle, OUTER_R + 16);
          return (
            <line
              key={sector.catKey}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={sector.color}
              strokeWidth="1.5"
              strokeOpacity="0.55"
              style={{ pointerEvents: "none" }}
            />
          );
        })}

        {/* Outer sector category labels (at sector start) */}
        {outerSectors.map((sector) => {
          const isActive = activeCategories.has(sector.catKey as Category);
          const labelAngle = sector.startAngle;
          const labelR = OUTER_TICK_R + 18;
          const { x, y } = polarToXY(labelAngle, labelR);
          const cosA = Math.cos(labelAngle);
          const sinA = Math.sin(labelAngle);
          const anchor: "start" | "middle" | "end" =
            cosA > 0.2 ? "start" : cosA < -0.2 ? "end" : "middle";
          // Vertical baseline shift: push down when above center
          const baselineY = sinA < -0.2 ? y - 6 : sinA > 0.2 ? y + 6 : y;

          const words = sector.label.split(" ");
          const half = Math.ceil(words.length / 2);
          const line1 = words.slice(0, half).join(" ");
          const line2 = words.slice(half).join(" ");

          return (
            <g key={sector.catKey} style={{ pointerEvents: "none" }}>
              {/* Color dot at sector boundary */}
              <circle
                cx={polarToXY(labelAngle, OUTER_R + 22).x}
                cy={polarToXY(labelAngle, OUTER_R + 22).y}
                r="3.5"
                fill={sector.color}
                fillOpacity={isActive ? 1 : 0.25}
                filter="url(#glow-soft)"
              />
              {/* Label line 1 */}
              <text
                x={x}
                y={baselineY}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize="10.5"
                fontWeight="700"
                fill={isActive ? sector.color : "#444"}
                fontFamily="Inter, system-ui, sans-serif"
                letterSpacing="0.02em"
                opacity={isActive ? 1 : 0.4}
              >
                {line1}
              </text>
              {/* Label line 2 */}
              {line2 && (
                <text
                  x={x}
                  y={baselineY + 13}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontSize="10.5"
                  fontWeight="700"
                  fill={isActive ? sector.color : "#444"}
                  fontFamily="Inter, system-ui, sans-serif"
                  letterSpacing="0.02em"
                  opacity={isActive ? 1 : 0.4}
                >
                  {line2}
                </text>
              )}
              {/* Project count at sector midpoint */}
              {(() => {
                const midAngle = sector.startAngle + (sector.endAngle - sector.startAngle) / 2;
                const { x: mx, y: my } = polarToXY(midAngle, OUTER_TICK_R + 34);
                return (
                  <text
                    x={mx}
                    y={my}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="9"
                    fill={sector.color}
                    fillOpacity={isActive ? 0.55 : 0.18}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontWeight="600"
                  >
                    {sector.count}
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* ═══════════════════════════════════════════════════════════════════
            CONNECTING LINES: inner dot → outer dot
        ════════════════════════════════════════════════════════════════════ */}
        {placed.map((p) => {
          const isActive = activeCategories.has(p.category);
          const isHovered = hoveredId === p.id;
          const color = getCategoryColor(p.category);
          return (
            <line
              key={`conn-${p.id}`}
              x1={p.px}
              y1={p.py}
              x2={p.outerX}
              y2={p.outerY}
              stroke={color}
              strokeWidth={isHovered ? 1.2 : 0.6}
              strokeOpacity={isActive ? (isHovered ? 0.45 : 0.1) : 0.03}
              style={{ pointerEvents: "none" }}
            />
          );
        })}

        {/* ═══════════════════════════════════════════════════════════════════
            INNER RADAR DOTS
        ════════════════════════════════════════════════════════════════════ */}
        {placed.map((p) => {
          const isActive = activeCategories.has(p.category);
          const isHovered = hoveredId === p.id;
          const isBucketHighlighted =
            highlightBucket !== null &&
            highlightBucket.catIdx === p.sectorIndex &&
            highlightBucket.ring === p.ring;
          const color = getCategoryColor(p.category);
          const isCancelled = p.stage === "Cancelado";
          const dotRadius = isHovered ? DOT_R + 2 : DOT_R;
          const opacity = isActive ? (isCancelled ? 0.35 : 1) : 0.07;

          return (
            <g key={`inner-${p.id}`}>
              {isActive && !isCancelled && (
                <circle
                  cx={p.px}
                  cy={p.py}
                  r={isHovered || isBucketHighlighted ? 13 : 9}
                  fill={color}
                  fillOpacity={isHovered ? 0.28 : isBucketHighlighted ? 0.2 : 0.1}
                  style={{ pointerEvents: "none" }}
                />
              )}
              <circle
                cx={p.px}
                cy={p.py}
                r={dotRadius}
                fill={isCancelled ? "#555" : color}
                fillOpacity={opacity}
                stroke={isCancelled ? "#666" : color}
                strokeWidth={isHovered ? 2 : 1.5}
                strokeOpacity={isActive ? 1 : 0.12}
                filter={
                  isHovered
                    ? "url(#glow-strong)"
                    : isActive && !isCancelled
                    ? "url(#glow-soft)"
                    : undefined
                }
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => handleDotMouseEnter(e, p)}
                onMouseLeave={handleDotMouseLeave}
                onClick={(e) => handleDotClick(e, p)}
              />
            </g>
          );
        })}

        {/* ═══════════════════════════════════════════════════════════════════
            OUTER RING DOTS
        ════════════════════════════════════════════════════════════════════ */}
        {placed.map((p) => {
          const isActive = activeCategories.has(p.category);
          const isHovered = hoveredId === p.id;
          const color = getCategoryColor(p.category);
          const isCancelled = p.stage === "Cancelado";
          return (
            <circle
              key={`outer-${p.id}`}
              cx={p.outerX}
              cy={p.outerY}
              r={isHovered ? 5 : 4}
              fill={isCancelled ? "#555" : color}
              fillOpacity={isActive ? (isCancelled ? 0.3 : 0.85) : 0.08}
              stroke={color}
              strokeWidth={isHovered ? 2 : 0}
              strokeOpacity={0.9}
              filter={isHovered ? "url(#glow-strong)" : undefined}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => handleDotMouseEnter(e, p)}
              onMouseLeave={handleDotMouseLeave}
              onClick={(e) => handleDotClick(e, p)}
            />
          );
        })}

        {/* Center glow */}
        <circle
          cx={CX}
          cy={CY}
          r="16"
          fill="hsl(220,80%,40%)"
          fillOpacity="0.3"
          stroke="hsl(220,80%,60%)"
          strokeWidth="1.5"
          style={{ pointerEvents: "none" }}
        />
        <circle
          cx={CX}
          cy={CY}
          r="6"
          fill="hsl(220,80%,70%)"
          filter="url(#glow-strong)"
          style={{ pointerEvents: "none" }}
        />

        {/* Tooltip */}
        {tooltip && (() => {
          const toX = Math.min(tooltip.svgX + 16, RADAR_SIZE - 260);
          const toY = Math.min(Math.max(10, tooltip.svgY - 10), RADAR_SIZE - 90);
          const color = getCategoryColor(tooltip.project.category);
          return (
            <g style={{ pointerEvents: "none" }}>
              <foreignObject x={toX} y={toY} width="250" height="90">
                <div
                  style={{
                    background: "rgba(7,11,28,0.96)",
                    border: `1px solid ${color}50`,
                    borderRadius: "8px",
                    padding: "9px 13px",
                    fontFamily: "Inter, system-ui, sans-serif",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color,
                      marginBottom: "4px",
                      lineHeight: "1.35",
                    }}
                  >
                    {tooltip.project.title.length > 52
                      ? tooltip.project.title.slice(0, 52) + "…"
                      : tooltip.project.title}
                  </div>
                  <div style={{ fontSize: "10px", color: "rgba(170,190,255,0.6)" }}>
                    {tooltip.project.stage} · {tooltip.project.id}
                  </div>
                </div>
              </foreignObject>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
