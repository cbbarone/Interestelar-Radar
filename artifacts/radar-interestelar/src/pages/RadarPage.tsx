import { useState, useMemo } from "react";
import { RadarChart, visibleProjects, type PlacedProject } from "@/components/RadarChart";
import { CATEGORIES, STAGES, getCategoryLabel, type Category } from "@/data/projects";

function StagesBadge({ stage }: { stage: string }) {
  const stageInfo = STAGES.find((s) => s.key === stage);
  const ring = stageInfo?.ring ?? 6;
  const colors = [
    "#34D399", "#10B981", "#38BDF8", "#818CF8", "#F59E0B", "#A78BFA", "#FB7185", "#9CA3AF",
  ];
  const color = colors[ring] ?? "#9CA3AF";
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      {stage}
    </span>
  );
}

function ProjectPanel({
  project,
  onClose,
  onBack,
}: {
  project: PlacedProject;
  onClose: () => void;
  onBack?: () => void;
}) {
  const { color } = CATEGORIES.find((c) => c.key === project.category) ?? { color: "#888" };

  return (
    <div className="fade-in-up flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        {onBack && (
          <button
            onClick={onBack}
            className="shrink-0 flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7 2L3 6L7 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Lista
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-colors text-xs"
        >
          ✕
        </button>
      </div>

      <div className="text-sm font-bold leading-snug mb-3" style={{ color }}>
        {project.title}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}
        >
          {getCategoryLabel(project.category)}
        </span>
        <StagesBadge stage={project.stage} />
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {project.description ? (
          <p className="text-xs text-slate-300 leading-relaxed">{project.description}</p>
        ) : (
          <p className="text-xs text-slate-500 italic">Sem descrição disponível.</p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-white/8 flex items-center justify-between">
        <span className="text-xs text-slate-600 font-mono">{project.id}</span>
        <a
          href={project.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
          style={{ background: `${color}20`, border: `1px solid ${color}40`, color }}
        >
          Jira
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </div>
  );
}

function BucketListPanel({
  bucketProjects,
  catIdx,
  ring,
  onSelectProject,
  onClose,
}: {
  bucketProjects: PlacedProject[];
  catIdx: number;
  ring: number;
  onSelectProject: (p: PlacedProject) => void;
  onClose: () => void;
}) {
  const cat = CATEGORIES[catIdx];
  const ringColors = [
    "#34D399", "#10B981", "#38BDF8", "#818CF8", "#F59E0B", "#A78BFA", "#FB7185", "#9CA3AF",
  ];
  const ringColor = ringColors[ring] ?? "#9CA3AF";
  const ringLabel = [
    "Concluído", "Sol. experimentada", "Em experimentação", "Em definição",
    "Em aprofundamento", "Gerar ideias", "Identificado", "Cancelado",
  ][ring] ?? "";

  return (
    <div className="fade-in-up flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold" style={{ color: cat?.color ?? "#888" }}>
          {cat?.label ?? "Projetos"}
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-colors text-xs"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
          style={{ background: `${ringColor}18`, border: `1px solid ${ringColor}40`, color: ringColor }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ringColor }} />
          {ringLabel}
        </span>
        <span className="text-xs text-slate-500">{bucketProjects.length} projetos</span>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
        {bucketProjects.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelectProject(p)}
            className="text-left px-3 py-2.5 rounded-lg transition-all hover:bg-white/6 group"
            style={{ border: "1px solid transparent" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = `${cat?.color ?? "#888"}30`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "transparent";
            }}
          >
            <div
              className="text-xs font-medium leading-snug mb-1 group-hover:text-white transition-colors"
              style={{ color: cat?.color ?? "#ccc" }}
            >
              {p.title}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-mono">{p.id}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatsBar() {
  const total = visibleProjects.length;
  const concluded = visibleProjects.filter(
    (p) => p.stage === "Concluído" || p.stage === "Finalizado"
  ).length;
  const inProgress = visibleProjects.filter(
    (p) =>
      p.stage === "Solução experimentada" ||
      p.stage === "Em experimentação" ||
      p.stage === "Em acompanhamento" ||
      p.stage === "Em progresso"
  ).length;
  const gearingUp = visibleProjects.filter(
    (p) => p.stage === "Gerar ideias" || p.stage === "Em definição do produto/estratégia" || p.stage === "Em aprofundamento"
  ).length;

  return (
    <div className="flex flex-wrap gap-4 text-center">
      <div>
        <div className="text-2xl font-bold text-white">{total}</div>
        <div className="text-xs text-slate-500 mt-0.5">Total</div>
      </div>
      <div className="w-px bg-white/8" />
      <div>
        <div className="text-2xl font-bold text-emerald-400">{concluded}</div>
        <div className="text-xs text-slate-500 mt-0.5">Concluídos</div>
      </div>
      <div className="w-px bg-white/8" />
      <div>
        <div className="text-2xl font-bold text-sky-400">{inProgress}</div>
        <div className="text-xs text-slate-500 mt-0.5">Em andamento</div>
      </div>
      <div className="w-px bg-white/8" />
      <div>
        <div className="text-2xl font-bold text-amber-400">{gearingUp}</div>
        <div className="text-xs text-slate-500 mt-0.5">Em ideação</div>
      </div>
    </div>
  );
}

type PanelMode =
  | { kind: "none" }
  | { kind: "project"; project: PlacedProject; fromBucket?: { ps: PlacedProject[]; catIdx: number; ring: number } }
  | { kind: "bucket"; ps: PlacedProject[]; catIdx: number; ring: number };

export function RadarPage() {
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    new Set(CATEGORIES.map((c) => c.key))
  );
  const [panel, setPanel] = useState<PanelMode>({ kind: "none" });

  function toggleCategory(key: Category) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleAll() {
    if (activeCategories.size === CATEGORIES.length) {
      setActiveCategories(new Set([CATEGORIES[0].key]));
    } else {
      setActiveCategories(new Set(CATEGORIES.map((c) => c.key)));
    }
  }

  function handleProjectClick(p: PlacedProject) {
    setPanel({ kind: "project", project: p });
  }

  function handleBucketClick(ps: PlacedProject[], catIdx: number, ring: number) {
    if (ps.length === 1) {
      setPanel({ kind: "project", project: ps[0] });
    } else {
      setPanel({ kind: "bucket", ps, catIdx, ring });
    }
  }

  function handleSelectFromBucket(
    p: PlacedProject,
    bucket: { ps: PlacedProject[]; catIdx: number; ring: number }
  ) {
    setPanel({ kind: "project", project: p, fromBucket: bucket });
  }

  function closePanel() {
    setPanel({ kind: "none" });
  }

  const showPanel = panel.kind !== "none";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "radial-gradient(ellipse at 50% -10%, hsl(220 60% 8%) 0%, hsl(225 39% 4%) 60%)" }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/6">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, hsl(220,80%,40%), hsl(240,70%,50%))" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="white" strokeWidth="1.5" />
              <circle cx="8" cy="8" r="4" stroke="white" strokeWidth="1" />
              <circle cx="8" cy="8" r="1.5" fill="white" />
              <line x1="8" y1="1" x2="8" y2="3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="12.5" x2="8" y2="15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="1" y1="8" x2="3.5" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12.5" y1="8" x2="15" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">RADAR INTERESTELAR</h1>
            <p className="text-xs text-slate-500">CCEE · Gerência de Inovação</p>
          </div>
        </div>
        <StatsBar />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: categories */}
        <aside className="w-52 shrink-0 flex flex-col gap-1 p-4 border-r border-white/6 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 px-1">
            Categorias
          </div>
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/6"
            style={{ color: activeCategories.size === CATEGORIES.length ? "white" : "#6b7280" }}
          >
            <span
              className="w-3 h-3 rounded-sm border flex items-center justify-center"
              style={{
                borderColor: activeCategories.size === CATEGORIES.length ? "white" : "#4b5563",
                background:
                  activeCategories.size === CATEGORIES.length
                    ? "rgba(255,255,255,0.15)"
                    : "transparent",
              }}
            >
              {activeCategories.size === CATEGORIES.length && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </span>
            Todos
          </button>
          {CATEGORIES.map((cat) => {
            const isOn = activeCategories.has(cat.key);
            const count = visibleProjects.filter((p) => p.category === cat.key).length;
            return (
              <button
                key={cat.key}
                onClick={() => toggleCategory(cat.key)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-all hover:bg-white/5 text-left"
                style={{ background: isOn ? `${cat.color}10` : "transparent" }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    background: isOn ? cat.color : "transparent",
                    border: `2px solid ${isOn ? cat.color : "#4b5563"}`,
                    boxShadow: isOn ? `0 0 6px ${cat.color}60` : "none",
                  }}
                />
                <span
                  className="flex-1 leading-tight font-medium"
                  style={{ color: isOn ? "rgba(255,255,255,0.9)" : "#6b7280" }}
                >
                  {cat.label}
                </span>
                <span className="text-slate-600 font-mono">{count}</span>
              </button>
            );
          })}

          <div className="mt-4 pt-4 border-t border-white/6">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 px-1">
              Anéis (Etapa)
            </div>
            {STAGES.filter((s, i, arr) => arr.findIndex((x) => x.ring === s.ring) === i && s.ring < 6)
              .sort((a, b) => a.ring - b.ring)
              .map((s) => {
                const ringColors = [
                  "#34D399", "#10B981", "#38BDF8", "#818CF8",
                  "#F59E0B", "#A78BFA",
                ];
                const c = ringColors[s.ring];
                return (
                  <div key={s.ring} className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: c, boxShadow: `0 0 4px ${c}80` }}
                    />
                    <span className="leading-tight">{s.label}</span>
                  </div>
                );
              })}
          </div>

          {/* Hint */}
          <div className="mt-auto pt-4 px-1">
            <p className="text-xs text-slate-600 leading-relaxed">
              Clique em um <strong className="text-slate-500">ponto</strong> ou em qualquer <strong className="text-slate-500">área do radar</strong> para ver os projetos daquele setor.
            </p>
          </div>
        </aside>

        <main className="flex-1 flex overflow-hidden">
          {/* Radar */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            <RadarChart
              activeCategories={activeCategories}
              onProjectClick={handleProjectClick}
              onBucketClick={handleBucketClick}
            />
          </div>

          {/* Right panel */}
          {showPanel && (
            <aside className="w-72 shrink-0 border-l border-white/6 p-4 overflow-y-auto glass-panel">
              {panel.kind === "project" && (
                <ProjectPanel
                  project={panel.project}
                  onClose={closePanel}
                  onBack={
                    panel.fromBucket
                      ? () =>
                          setPanel({
                            kind: "bucket",
                            ps: panel.fromBucket!.ps,
                            catIdx: panel.fromBucket!.catIdx,
                            ring: panel.fromBucket!.ring,
                          })
                      : undefined
                  }
                />
              )}
              {panel.kind === "bucket" && (
                <BucketListPanel
                  bucketProjects={panel.ps}
                  catIdx={panel.catIdx}
                  ring={panel.ring}
                  onSelectProject={(p) =>
                    handleSelectFromBucket(p, {
                      ps: panel.ps,
                      catIdx: panel.catIdx,
                      ring: panel.ring,
                    })
                  }
                  onClose={closePanel}
                />
              )}
            </aside>
          )}
        </main>
      </div>
    </div>
  );
}
