import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
const RADAR_SIZE = 900;
const CX = RADAR_SIZE / 2;
const CY = RADAR_SIZE / 2;
const MIN_R = 48;
const MAX_R = 418;
const RING_STEP = (MAX_R - MIN_R) / (NUM_RINGS - 1);

function ringRadius(ring: number): number {
  return MIN_R + ring * RING_STEP;
}

const NUM_CATEGORIES = CATEGORIES.length;
const SECTOR_ANGLE = (2 * Math.PI) / NUM_CATEGORIES;
const START_OFFSET = -Math.PI / 2;

function polarToXY(angle: number, radius: number) {
  return {
    x: CX + radius * Math.cos(angle),
    y: CY + radius * Math.sin(angle),
  };
}

function sectorPath(startAngle: number, endAngle: number, innerR: number, outerR: number): string {
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

interface PlacedProject extends Project {
  px: number;
  py: number;
  ring: number;
  sectorIndex: number;
}

function placeProjects(): PlacedProject[] {
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  };

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
  let seed = 0;

  buckets.forEach((ps, key) => {
    const [catIdxStr, ringStr] = key.split("-");
    const catIdx = parseInt(catIdxStr);
    const ring = parseInt(ringStr);

    const startAngle = START_OFFSET + catIdx * SECTOR_ANGLE;
    const endAngle = startAngle + SECTOR_ANGLE;
    const innerR = ring === 0 ? 0 : ringRadius(ring - 1) + 6;
    const outerR = ringRadius(ring) - 6;

    const midAngle = (startAngle + endAngle) / 2;
    const spreadAngle = (SECTOR_ANGLE * 0.72) / 2;
    const minR = Math.max(innerR + 8, 8);
    const maxR = outerR - 4;

    ps.forEach((p, i) => {
      const n = ps.length;
      let angle: number, r: number;

      if (n === 1) {
        angle = midAngle + (seededRandom(seed++) - 0.5) * spreadAngle * 0.4;
        r = (minR + maxR) / 2 + (seededRandom(seed++) - 0.5) * (maxR - minR) * 0.3;
      } else {
        const cols = Math.ceil(Math.sqrt(n * 1.8));
        const rows = Math.ceil(n / cols);
        const col = i % cols;
        const row = Math.floor(i / cols);
        const t = cols > 1 ? col / (cols - 1) : 0.5;
        const s = rows > 1 ? row / (rows - 1) : 0.5;
        angle = startAngle + spreadAngle * (0.14 + t * 0.72) + spreadAngle * 0.12;
        r = minR + (maxR - minR) * (0.15 + s * 0.7);
        angle += (seededRandom(seed++) - 0.5) * spreadAngle * 0.1;
        r += (seededRandom(seed++) - 0.5) * (maxR - minR) * 0.08;
      }

      r = Math.max(minR, Math.min(maxR, r));
      const { x, y } = polarToXY(angle, r);
      placed.push({ ...p, px: x, py: y, ring, sectorIndex: catIdx });
    });
  });

  return placed;
}

const RING_LABEL_INFO = [
  { label: "Concluído", short: "Concluído" },
  { label: "Solução experimentada", short: "Sol. experimentada" },
  { label: "Em experimentação", short: "Em experimentação" },
  { label: "Em definição", short: "Em definição" },
  { label: "Em aprofundamento", short: "Em aprofundamento" },
  { label: "Gerar ideias", short: "Gerar ideias" },
  { label: "Identificado", short: "Identificado" },
  { label: "Cancelado", short: "Cancelado" },
];

interface TooltipState {
  project: PlacedProject;
  x: number;
  y: number;
}

interface Props {
  activeCategories: Set<Category>;
  onProjectClick: (p: PlacedProject) => void;
}

export function RadarChart({ activeCategories, onProjectClick }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const placed = useMemo(() => placeProjects(), []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGCircleElement>, p: PlacedProject) => {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      setTooltip({ project: p, x: e.clientX - svgRect.left, y: e.clientY - svgRect.top });
      setHoveredId(p.id);
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setHoveredId(null);
  }, []);

  return (
    <div className="relative w-full select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
        className="w-full h-full"
        style={{ maxHeight: "82vh" }}
      >
        <defs>
          {CATEGORIES.map((cat) => (
            <radialGradient key={cat.key} id={`grad-${cat.key}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={cat.color} stopOpacity="0.04" />
              <stop offset="100%" stopColor={cat.color} stopOpacity="0.11" />
            </radialGradient>
          ))}
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

        <circle cx={CX} cy={CY} r={MAX_R + 4} fill="url(#bg-gradient)" />

        {CATEGORIES.map((cat, i) => {
          const startAngle = START_OFFSET + i * SECTOR_ANGLE;
          const endAngle = startAngle + SECTOR_ANGLE;
          const isActive = activeCategories.has(cat.key);
          return (
            <path
              key={cat.key}
              d={sectorPath(startAngle, endAngle, 0, MAX_R + 4)}
              fill={isActive ? cat.color : "#444"}
              fillOpacity={isActive ? 0.07 : 0.02}
              clipPath="url(#radar-clip)"
            />
          );
        })}

        {Array.from({ length: NUM_RINGS }, (_, i) => (
          <circle
            key={i}
            cx={CX}
            cy={CY}
            r={ringRadius(i)}
            fill="none"
            stroke="rgba(120,160,255,0.13)"
            strokeWidth={i === 0 ? 1.5 : 1}
            strokeDasharray={i === NUM_RINGS - 1 ? "6 4" : undefined}
          />
        ))}

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
              stroke="rgba(120,160,255,0.15)"
              strokeWidth="1"
            />
          );
        })}

        {CATEGORIES.map((cat, i) => {
          const midAngle = START_OFFSET + (i + 0.5) * SECTOR_ANGLE;
          const labelR = MAX_R + 28;
          const { x, y } = polarToXY(midAngle, labelR);
          const isActive = activeCategories.has(cat.key);
          const angleDeg = ((midAngle * 180) / Math.PI + 360) % 360;
          let anchor: "middle" | "start" | "end" = "middle";
          if (angleDeg > 20 && angleDeg < 160) anchor = "middle";
          else if (angleDeg >= 160 && angleDeg < 200) anchor = "middle";

          const isRight = Math.cos(midAngle) > 0.3;
          const isLeft = Math.cos(midAngle) < -0.3;
          if (isRight) anchor = "start";
          if (isLeft) anchor = "end";

          const catLabel = cat.label;
          const words = catLabel.split(" ");
          const line1 = words.slice(0, Math.ceil(words.length / 2)).join(" ");
          const line2 = words.slice(Math.ceil(words.length / 2)).join(" ");

          return (
            <g key={cat.key} opacity={isActive ? 1 : 0.3}>
              <circle
                cx={polarToXY(midAngle, MAX_R + 10).x}
                cy={polarToXY(midAngle, MAX_R + 10).y}
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
                fill={isActive ? cat.color : "#666"}
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
                  fill={isActive ? cat.color : "#666"}
                  fontFamily="Inter, system-ui, sans-serif"
                  letterSpacing="0.02em"
                >
                  {line2}
                </text>
              )}
            </g>
          );
        })}

        {Array.from({ length: NUM_RINGS }, (_, i) => {
          const r = ringRadius(i);
          const angle = START_OFFSET + 0.04;
          const { x, y } = polarToXY(angle, r - 6);
          return (
            <text
              key={i}
              x={x}
              y={y}
              fontSize="9"
              fill="rgba(120,160,255,0.45)"
              fontFamily="Inter, system-ui, sans-serif"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {RING_LABEL_INFO[i]?.short}
            </text>
          );
        })}

        {placed.map((p) => {
          const isActive = activeCategories.has(p.category);
          const isHovered = hoveredId === p.id;
          const color = getCategoryColor(p.category);
          const isCancelled = p.stage === "Cancelado";
          const r = isHovered ? 7 : 5;
          const opacity = isActive ? (isCancelled ? 0.35 : 1) : 0.1;

          return (
            <g key={p.id}>
              {isActive && !isCancelled && (
                <circle
                  cx={p.px}
                  cy={p.py}
                  r={isHovered ? 12 : 9}
                  fill={color}
                  fillOpacity={isHovered ? 0.25 : 0.12}
                />
              )}
              <circle
                cx={p.px}
                cy={p.py}
                r={r}
                fill={isCancelled ? "#555" : color}
                fillOpacity={opacity}
                stroke={isCancelled ? "#666" : color}
                strokeWidth={isHovered ? 2 : 1.5}
                strokeOpacity={isActive ? 1 : 0.2}
                className="radar-dot"
                filter={isHovered ? "url(#glow-strong)" : isActive && !isCancelled ? "url(#glow-soft)" : undefined}
                onMouseMove={(e) => handleMouseMove(e, p)}
                onMouseLeave={handleMouseLeave}
                onClick={() => onProjectClick(p)}
              />
            </g>
          );
        })}

        <circle
          cx={CX}
          cy={CY}
          r="16"
          fill="hsl(220,80%,40%)"
          fillOpacity="0.3"
          stroke="hsl(220,80%,60%)"
          strokeWidth="1.5"
        />
        <circle cx={CX} cy={CY} r="6" fill="hsl(220,80%,70%)" filter="url(#glow-strong)" />

        {tooltip && (
          <foreignObject
            x={Math.min(tooltip.x + 12, RADAR_SIZE - 240)}
            y={Math.min(tooltip.y - 10, RADAR_SIZE - 80)}
            width="230"
            height="80"
            style={{ pointerEvents: "none" }}
          >
            <div
              style={{
                background: "rgba(8,12,30,0.95)",
                border: `1px solid ${getCategoryColor(tooltip.project.category)}44`,
                borderRadius: "8px",
                padding: "8px 12px",
                fontFamily: "Inter, system-ui, sans-serif",
                backdropFilter: "blur(12px)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: getCategoryColor(tooltip.project.category),
                  marginBottom: "3px",
                  lineHeight: "1.3",
                }}
              >
                {tooltip.project.title.length > 52
                  ? tooltip.project.title.slice(0, 52) + "…"
                  : tooltip.project.title}
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: "rgba(180,200,255,0.7)",
                  lineHeight: "1.3",
                }}
              >
                {tooltip.project.stage} · {tooltip.project.id}
              </div>
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  );
}

export type { PlacedProject };
