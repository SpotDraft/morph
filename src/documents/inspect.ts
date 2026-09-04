import type { SuperDocDocument } from "@superdoc/sdk";
import { agentContract, agentLoop } from "../agent/catalog.js";
import { buildOutline } from "./query.js";

export interface InspectCell {
  nodeId: string;
  cellNodeId: string | null;
  row: number;
  col: number;
  text: string;
}

export interface InspectTable {
  tableOrdinal: number;
  tableNodeId: string | null;
  rows: number;
  cols: number;
  cells: InspectCell[];
}

export async function inspectDocument(doc: SuperDocDocument) {
  const [outline, extract, lists, discovered] = await Promise.all([
    buildOutline(doc),
    doc.extract(),
    doc.lists.list().catch(() => null),
    discoverTables(doc),
  ]);

  const tables = new Map<number, InspectTable>();
  for (const block of extract.blocks) {
    const ctx = block.tableContext;
    if (!ctx) continue;
    const found = discovered[ctx.tableOrdinal];
    const current =
      tables.get(ctx.tableOrdinal) ??
      {
        tableOrdinal: ctx.tableOrdinal,
        tableNodeId: found?.tableNodeId ?? null,
        rows: 0,
        cols: 0,
        cells: [],
      };
    const engineCell = found?.cells.find((c) => c.row === ctx.rowIndex && c.col === ctx.columnIndex);
    current.cells.push({
      nodeId: block.nodeId,
      cellNodeId: engineCell?.cellNodeId ?? null,
      row: ctx.rowIndex,
      col: ctx.columnIndex,
      text: block.text ?? "",
    });
    current.rows = Math.max(current.rows, ctx.rowIndex + 1);
    current.cols = Math.max(current.cols, ctx.columnIndex + 1);
    tables.set(ctx.tableOrdinal, current);
  }

  const listItems = (lists as { items?: Array<Record<string, unknown>> } | null)?.items ?? [];

  return {
    revision: outline.revision,
    counts: outline.counts,
    headings: (outline.outline ?? []).map((h) => ({
      nodeId: h.nodeId,
      level: h.level,
      text: h.text,
    })),
    blocks: outline.blocks,
    tables: [...tables.values()].map((table) => ({
      ...table,
      cells: table.cells.sort((a, b) => a.row - b.row || a.col - b.col),
    })),
    lists: listItems.map((item) => ({
      nodeId: (item.address as { nodeId?: string } | undefined)?.nodeId ?? item.nodeId,
      marker: item.marker ?? null,
      path: item.path ?? null,
      textPreview: typeof item.text === "string" ? item.text.slice(0, 160) : null,
    })),
    comments: (extract.comments ?? []).map((c) => ({
      entityId: c.entityId,
      status: c.status,
      anchoredText: c.anchoredText ?? null,
      blockId: c.blockId ?? null,
    })),
    trackedChanges: (extract.trackedChanges ?? []).map((t) => ({
      entityId: t.entityId,
      type: t.type,
      blockIds: t.blockIds ?? [],
    })),
    loop: agentLoop(),
    targeting: agentContract().targeting,
    afterMutate: agentContract().afterMutate,
  };
}

export async function discoverTables(doc: SuperDocDocument): Promise<
  Array<{ tableOrdinal: number; tableNodeId: string; cells: Array<{ row: number; col: number; cellNodeId: string }> }>
> {
  try {
    const raw = await doc.query.match({
      select: { type: "node", nodeType: "table" },
      require: "any",
    } as never);
    const out: Array<{
      tableOrdinal: number;
      tableNodeId: string;
      cells: Array<{ row: number; col: number; cellNodeId: string }>;
    }> = [];
    for (const [index, item] of (raw.items ?? []).entries()) {
      const tableNodeId = (item as { address?: { nodeId?: string } }).address?.nodeId;
      if (!tableNodeId) continue;
      let cells: Array<{ row: number; col: number; cellNodeId: string }> = [];
      try {
        const got = await doc.tables.getCells({
          target: { kind: "block", nodeType: "table", nodeId: tableNodeId },
        });
        cells = (got.cells ?? []).map((c) => ({
          row: c.rowIndex,
          col: c.columnIndex,
          cellNodeId: c.nodeId,
        }));
      } catch {
        cells = [];
      }
      out.push({ tableOrdinal: index, tableNodeId, cells });
    }
    return out;
  } catch {
    return [];
  }
}
