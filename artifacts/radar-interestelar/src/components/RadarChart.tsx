import { useState, useMemo, useCallback, useRef } from "react";
import {
  projects,
  CATEGORIES,
  STAGES,
  getCategoryColor,
  getStageRing,
  type Project,
  type Category,
} from "@/data/projects";

const NUM_RINGS = 8;
const RADAR_SIZE = 960;
const CX = RADAR_SIZE / 2;
const CY = RADAR_SIZE / 2;
const MIN_R = 52;
const MAX_R = 440;
const RING_STEP = (MAX_R - MIN_R) / (NUM_RINGS - 1);
const DOT_R = 5;
const MIN_SPACING = DOT_R * 2 + 3; // 13px center-to-center

function ringRadius(ring: number): number {
  return MIN_R + ring * RING_STEP;
}

const NUM_CATEGORIES = CATEGORIES.length;
const SECTOR_ANGLE = (2 * Math.PI) / NUM_CATEGORIES;
const START_OFFSET = -Math.PI / 2;
const ANG_MARGIN_FRAC = 0.07;

function polarToXY(angle: number, radius: number) {
  return {
    x: CX + radius * Math.cos(angle),
    y: CY + radius * Math.sin(angle),
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

export interface PlacedProject extends Project {
  px: number;
  py: number;
  ring: number;
  sectorIndex: number;
}

function placeProjects(): PlacedProject[] {
  const buckets: Map<string, Project[]> = new Map();
  for (const p of projects) {
    const ring = getStageRing(p.stage);
    const catIdx = CATEGORIES.findIndex((c) => c.key === p.category);
    if (catIdx < 0) continue;
    const key = `${catIdx}-${ring}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }

  const placed: PlacedProject[] = [];

  buckets.forEach((ps, key) => {
    const [catIdxStr, ringStr] = key.split("-");
    const catIdx = parseInt(catIdxStr);
    const ring = parseInt(ringStr);
    const n = ps.length;

    const startAngle = START_OFFSET + catIdx * SECTOR_ANGLE;
    const endAngle = startAngle + SECTOR_ANGLE;

    // Radial bounds with padding
    const innerR = ring === 0 ? MIN_R * 0.25 : ringRadius(ring - 1) + DOT_R + 3;
    const outerR = ringRadius(ring) - DOT_R - 3;
    const radialExtent = Math.max(1, outerR - innerR);

    // Angular bounds with margin
    const angMargin = SECTOR_ANGLE * ANG_MARGIN_FRAC;
    const minAngle = startAngle + angMargin;
    const maxAngle = endAngle - angMargin;
    const angExtent = maxAngle - minAngle;

    // Mid-radius arc length determines how many columns fit
    const midR = (innerR + outerR) / 2;
    const arcLen = midR * angExtent;

    // Compute grid dimensions: maximize columns (angular) first
    const maxCols = Math.max(1, Math.floor(arcLen / MIN_SPACING));
    const maxRows = Math.max(1, Math.floor(radialExtent / MIN_SPACING));

    // Choose cols to be at most maxCols and at least ceil(n/maxRows)
    let cols = Math.min(maxCols, Math.max(1, Math.ceil(n / maxRows)));
    // Adjust: try to make the grid as square-ish as possible
    const idealCols = Math.ceil(Math.sqrt(n * (arcLen / Math.max(1, radialExtent))));
    cols = Math.min(maxCols, Math.max(cols, Math.min(idealCols, n)));

    let rows = Math.ceil(n / cols);

    // If rows exceed maxRows, we need more cols to compress vertically
    if (rows > maxRows) {
      rows = maxRows;
      cols = Math.ceil(n / rows);
      // cols might exceed maxCols — scale down MIN_SPACING gracefully
    }

    // Compute actual spacing used
    const actualAngSpacing = cols > 1 ? angExtent / (cols - 1) : 0;
    const actualRadSpacing = rows > 1 ? radialExtent / (rows - 1) : 0;

    ps.forEach((p, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const tA = cols > 1 ? col / (cols - 1) : 0.5;
      const tR = rows > 1 ? row / (rows - 1) : 0.5;

      // Alternate row offset (brick pattern) so dots don't stack perfectly
      const brickOffset = row % 2 === 0 ? 0 : actualAngSpacing * 0.5;
      const angle = minAngle + tA * angExtent + brickOffset;
      const r = innerR + tR * radialExtent;

      // Clamp to bounds
      const clampedAngle = Math.max(minAngle, Math.min(maxAngle, angle));
      const clampedR = Math.max(innerR, Math.min(outerR, r));

      const { x, y } = polarToXY(clampedAngle, clampedR);
      placed.push({ ...p, px: x, py: y, ring, sectorIndex: catIdx });
    });
  });

  return placed;
}

const RING_LABEL_INFO = [
  { short: "Concluído" },
  { short: "Sol. experimentada" },
  { short: "Em experimentação" },
  { short: "Em definição" },
  { short: "Em aprofundamento" },
  { short: "Gerar ideias" },
  { short: "Identificado" },
  { short: "Cancelado" },
];

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

  const placed = useMemo(() => placeProjects(), []);

  // Group placed projects by bucket for sector-click logic
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

  // Clicking a sector background opens the bucket list for that sector+ring
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
      // Determine which ring was clicked
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

  return (
    <div className="relative w-full select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
        className="w-full h-full"
        style={{ maxHeight: "82vh" }}
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

        {/* Background */}
        <circle cx={CX} cy={CY} r={MAX_R + 4} fill="url(#bg-gradient)" />

        {/* Sector fills — clickable */}
        {CATEGORIES.map((cat, i) => {
          const startAngle = START_OFFSET + i * SECTOR_ANGLE;
          const endAngle = startAngle + SECTOR_ANGLE;
          const isActive = activeCategories.has(cat.key);
          const isHighlighted =
            highlightBucket !== null && highlightBucket.catIdx === i;
          return (
            <path
              key={cat.key}
              d={sectorPath(startAngle, endAngle, 0, MAX_R + 4)}
              fill={isActive ? cat.color : "#444"}
              fillOpacity={
                isHighlighted ? 0.14 : isActive ? 0.065 : 0.018
              }
              clipPath="url(#radar-clip)"
              style={{ cursor: "pointer" }}
              onClick={(e) => handleSectorRingClick(e, i)}
            />
          );
        })}

        {/* Ring circles */}
        {Array.from({ length: NUM_RINGS }, (_, i) => (
          <circle
            key={i}
            cx={CX}
            cy={CY}
            r={ringRadius(i)}
            fill="none"
            stroke="rgba(120,160,255,0.12)"
            strokeWidth={i === 0 ? 1.5 : 1}
            strokeDasharray={i === NUM_RINGS - 1 ? "6 4" : undefined}
            style={{ pointerEvents: "none" }}
          />
        ))}

        {/* Sector dividers */}
        {CATEGORIES.map((_, i) => {
          const angle = START_OFFSET + i * SECTOR_ANGLE;
          const inner = polarToXY(angle, 0);
          const outer = polarToXY(angle, MAX_R + 4);
          return (
            <line
              key={i}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(120,160,255,0.14)"
              strokeWidth="1"
              style={{ pointerEvents: "none" }}
            />
          );
        })}

        {/* Category labels */}
        {CATEGORIES.map((cat, i) => {
          const midAngle = START_OFFSET + (i + 0.5) * SECTOR_ANGLE;
          const labelR = MAX_R + 30;
          const { x, y } = polarToXY(midAngle, labelR);
          const isActive = activeCategories.has(cat.key);
          const isRight = Math.cos(midAngle) > 0.3;
          const isLeft = Math.cos(midAngle) < -0.3;
          let anchor: "middle" | "start" | "end" = "middle";
          if (isRight) anchor = "start";
          if (isLeft) anchor = "end";
          const words = cat.label.split(" ");
          const half = Math.ceil(words.length / 2);
          const line1 = words.slice(0, half).join(" ");
          const line2 = words.slice(half).join(" ");
          return (
            <g key={cat.key} opacity={isActive ? 1 : 0.28} style={{ pointerEvents: "none" }}>
              <circle
                cx={polarToXY(midAngle, MAX_R + 11).x}
                cy={polarToXY(midAngle, MAX_R + 11).y}
                r="4"
                fill={cat.color}
                filter="url(#glow-soft)"
              />
              <text
                x={x}
                y={y - (line2 ? 7 : 0)}
                textAnchor={anchor}
                fontSize="12"
                fontWeight="600"
                fill={isActive ? cat.color : "#555"}
                fontFamily="Inter, system-ui, sans-serif"
                letterSpacing="0.02em"
              >
                {line1}
              </text>
              {line2 && (
                <text
                  x={x}
                  y={y + 10}
                  textAnchor={anchor}
                  fontSize="12"
                  fontWeight="600"
                  fill={isActive ? cat.color : "#555"}
                  fontFamily="Inter, system-ui, sans-serif"
                  letterSpacing="0.02em"
                >
                  {line2}
                </text>
              )}
            </g>
          );
        })}

        {/* Ring labels */}
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
              fill="rgba(120,160,255,0.4)"
              fontFamily="Inter, system-ui, sans-serif"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ pointerEvents: "none" }}
            >
              {RING_LABEL_INFO[i]?.short}
            </text>
          );
        })}

        {/* Project dots */}
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
          const opacity = isActive ? (isCancelled ? 0.35 : 1) : 0.08;

          return (
            <g key={p.id}>
              {/* Glow halo */}
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
              {/* Main dot */}
              <circle
                cx={p.px}
                cy={p.py}
                r={dotRadius}
                fill={isCancelled ? "#555" : color}
                fillOpacity={opacity}
                stroke={isCancelled ? "#666" : color}
                strokeWidth={isHovered ? 2 : 1.5}
                strokeOpacity={isActive ? 1 : 0.15}
                className="radar-dot"
                filter={
                  isHovered
                    ? "url(#glow-strong)"
                    : isActive && !isCancelled
                    ? "url(#glow-soft)"
                    : undefined
                }
                onMouseEnter={(e) => handleDotMouseEnter(e, p)}
                onMouseLeave={handleDotMouseLeave}
                onClick={(e) => handleDotClick(e, p)}
              />
            </g>
          );
        })}

        {/* Center */}
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
        {tooltip && (
          <g style={{ pointerEvents: "none" }}>
            <foreignObject
              x={Math.min(tooltip.svgX + 14, RADAR_SIZE - 250)}
              y={Math.min(
                Math.max(10, tooltip.svgY - 10),
                RADAR_SIZE - 80
              )}
              width="240"
              height="90"
            >
              <div
                style={{
                  background: "rgba(7,11,28,0.96)",
                  border: `1px solid ${getCategoryColor(tooltip.project.category)}50`,
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
                    color: getCategoryColor(tooltip.project.category),
                    marginBottom: "4px",
                    lineHeight: "1.35",
                  }}
                >
                  {tooltip.project.title.length > 55
                    ? tooltip.project.title.slice(0, 55) + "…"
                    : tooltip.project.title}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "rgba(170,190,255,0.65)",
                  }}
                >
                  {tooltip.project.stage} · {tooltip.project.id}
                </div>
              </div>
            </foreignObject>
          </g>
        )}
      </svg>
    </div>
  );
}
