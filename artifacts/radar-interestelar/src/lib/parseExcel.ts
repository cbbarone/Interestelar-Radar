import * as XLSX from "xlsx";
import { CATEGORIES, STAGES, type Project } from "@/data/projects";

export interface ParseResult {
  projects: Project[];
  total: number;
  skipped: number;
  errors: string[];
}

export function parseExcelProjects(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

  const validCategoryKeys = new Set(CATEGORIES.map((c) => c.key));
  const validStageKeys = new Set(STAGES.map((s) => s.key));

  const projects: Project[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const category = row["CATEGORIA"]?.trim();
    const title = row["TÍTULO"]?.trim();
    const description = row["DESCRIÇÃO"]?.trim() ?? "";
    const stage = row["ETAPA"]?.trim();
    const link = row["LINK"]?.trim() ?? "";

    if (!category || !validCategoryKeys.has(category)) {
      errors.push(`Linha ${i + 2}: categoria desconhecida "${category ?? ""}"`);
      continue;
    }
    if (!title) {
      errors.push(`Linha ${i + 2}: título vazio`);
      continue;
    }
    if (!stage || !validStageKeys.has(stage)) {
      errors.push(`Linha ${i + 2}: etapa desconhecida "${stage ?? ""}"`);
      continue;
    }

    const id = link ? (link.split("/").pop() ?? `ROW-${i + 2}`) : `ROW-${i + 2}`;

    projects.push({
      id,
      title,
      description,
      category: category as Project["category"],
      stage: stage as Project["stage"],
      link,
    });
  }

  return {
    projects,
    total: rows.length,
    skipped: rows.length - projects.length,
    errors,
  };
}
