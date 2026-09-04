import type { SuperDocDocument } from "@superdoc/sdk";
import { MorphError } from "../errors.js";
import { inspectDocument, type InspectCell, type InspectTable } from "./inspect.js";

export interface ResolvedCell {
  paragraphId: string;
  cellNodeId: string | null;
  tableNodeId: string | null;
  tableOrdinal: number;
  rowIndex: number;
  columnIndex: number;
  text: string;
}

export async function resolveCellTarget(
  doc: SuperDocDocument,
  body: Record<string, unknown>,
): Promise<ResolvedCell> {
  const inspected = await inspectDocument(doc);
  const tableOrdinal = body.tableOrdinal != null ? Number(body.tableOrdinal) : 0;
  const table = pickTable(inspected.tables, tableOrdinal);
  if (!table) {
    throw new MorphError("TARGET_NOT_FOUND", "No table in this document", {
      detail: { tableOrdinal, tableCount: inspected.tables.length },
    });
  }

  const explicit = String(body.cellId || body.nodeId || "");
  const rowIndex = body.rowIndex != null ? Number(body.rowIndex) : undefined;
  const columnIndex = body.columnIndex != null ? Number(body.columnIndex) : undefined;

  let cell: InspectCell | undefined;
  if (explicit) {
    cell = table.cells.find((c) => c.nodeId === explicit || c.cellNodeId === explicit);
  }
  if (!cell && rowIndex != null && columnIndex != null) {
    cell = table.cells.find((c) => c.row === rowIndex && c.col === columnIndex);
  }
  if (!cell) {
    throw new MorphError("TARGET_NOT_FOUND", "No table cell matched rowIndex/columnIndex", {
      detail: {
        tableOrdinal: table.tableOrdinal,
        tableNodeId: table.tableNodeId,
        rowIndex,
        columnIndex,
        knownCells: table.cells.map((c) => ({ row: c.row, col: c.col, text: c.text.slice(0, 40) })),
      },
    });
  }
  return {
    paragraphId: cell.nodeId,
    cellNodeId: cell.cellNodeId,
    tableNodeId: table.tableNodeId,
    tableOrdinal: table.tableOrdinal,
    rowIndex: cell.row,
    columnIndex: cell.col,
    text: cell.text,
  };
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

export function rowPosition(position?: string): "above" | "below" {
  if (position === "before" || position === "above") return "above";
  return "below";
}
