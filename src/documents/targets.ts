import type { SuperDocDocument } from "@superdoc/sdk";
import { MorphError } from "../errors.js";
import { inspectDocument, type InspectTable } from "./inspect.js";

export async function resolveCellTarget(
  doc: SuperDocDocument,
  body: Record<string, unknown>,
): Promise<{ nodeId: string; rowIndex?: number; columnIndex?: number; tableOrdinal: number }> {
  const explicit = String(body.cellId || body.nodeId || "");
  const rowIndex = body.rowIndex != null ? Number(body.rowIndex) : undefined;
  const columnIndex = body.columnIndex != null ? Number(body.columnIndex) : undefined;
  const tableOrdinal = body.tableOrdinal != null ? Number(body.tableOrdinal) : 0;

  if (explicit) {
    return { nodeId: explicit, rowIndex, columnIndex, tableOrdinal };
  }

  const inspected = await inspectDocument(doc);
  const table = pickTable(inspected.tables, tableOrdinal);
  if (!table) {
    throw new MorphError("TARGET_NOT_FOUND", "No table in this document", {
      detail: { tableOrdinal, tableCount: inspected.tables.length },
    });
  }
  const cell = table.cells.find((c) => c.row === rowIndex && c.col === columnIndex);
  if (!cell?.nodeId) {
    throw new MorphError("TARGET_NOT_FOUND", "No table cell matched rowIndex/columnIndex", {
      detail: {
        tableOrdinal: table.tableOrdinal,
        rowIndex,
        columnIndex,
        knownCells: table.cells.map((c) => ({ row: c.row, col: c.col, text: c.text.slice(0, 40) })),
      },
    });
  }
  return { nodeId: cell.nodeId, rowIndex, columnIndex, tableOrdinal: table.tableOrdinal };
}

export function pickTable(tables: InspectTable[], tableOrdinal: number): InspectTable | undefined {
  return tables.find((t) => t.tableOrdinal === tableOrdinal) ?? tables[0];
}

export function relativeAt(
  kind: "before" | "after" | "documentStart" | "documentEnd",
  nodeType: string,
  nodeId: string,
) {
  if (kind === "documentStart") return { kind: "documentStart" as const };
  if (kind === "documentEnd") return { kind: "documentEnd" as const };
  return {
    kind,
    target: {
      kind: "block" as const,
      nodeType: nodeType as "paragraph" | "heading" | "listItem" | "table" | "tableCell",
      nodeId,
    },
  };
}
