import type { FastifyInstance } from "fastify";
import { AGENT_TOOLS, agentContract } from "../agent/catalog.js";
import { capacityReport } from "../admission/capacity.js";
import { inspectDocument } from "../documents/inspect.js";
import {
  applyReplace,
  assertExactlyOne,
  queryMatch,
  resolveNodeType,
  withRevisionRetry,
} from "../documents/query.js";
import { asReceipt } from "../documents/receipts.js";
import { getRegistry } from "../documents/registry.js";
import { relativeAt, resolveCellTarget, rowPosition } from "../documents/targets.js";
import { MorphError } from "../errors.js";
import { getHost } from "../hosts/sdk-host.js";
import { sessionIdOf, wrap } from "./helpers.js";

const FORMAT_MARKS = new Set(["bold", "italic", "underline", "strike", "highlight"]);

export async function agentRoutes(app: FastifyInstance) {
  app.get("/document/tools", async () => ({
    tools: AGENT_TOOLS,
    contract: agentContract(),
  }));

  app.get("/document/capacity", async () => capacityReport(getHost().stats()));

  app.post(
    "/document/inspect",
    wrap(async (request) => {
      const sessionId = sessionIdOf(request);
      return getRegistry().withDoc(sessionId, (doc) => inspectDocument(doc));
    }),
  );

  app.post(
    "/document/table/cell",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      const text = String(body.text ?? body.newText ?? "");
      if (!text) throw new MorphError("VALIDATION", "text is required");
      return getRegistry().mutate(sessionId, "table.cell", async (doc) => {
        const cell = await resolveCellTarget(doc, body);
        // v2 tables.setCellText is not tracked-capable. Rewrite the cell
        // paragraph so the agent still gets a Word redline.
        if (cell.text) {
          const match = await queryMatch(doc, {
            pattern: cell.text,
            require: "exactlyOne",
            caseSensitive: true,
            within: { nodeId: cell.paragraphId, nodeType: "paragraph" },
          });
          assertExactlyOne(match, cell.text);
          return applyReplace(doc, {
            target: match.items[0]?.target,
            text,
            expectedRevision: (body.expectedRevision as string | undefined) ?? match.evaluatedRevision,
          }).then((raw) => asReceipt("table.cell", raw, match.evaluatedRevision));
        }
        if (!cell.tableNodeId) {
          throw new MorphError("TARGET_NOT_FOUND", "Empty cell has no table nodeId to write", {
            detail: { tableOrdinal: cell.tableOrdinal, rowIndex: cell.rowIndex, columnIndex: cell.columnIndex },
          });
        }
        const raw = await withRevisionRetry(doc, body.expectedRevision as string | undefined, (rev) =>
          doc.tables.setCellText({
            text,
            target: { kind: "block", nodeType: "table", nodeId: cell.tableNodeId as string },
            rowIndex: cell.rowIndex,
            columnIndex: cell.columnIndex,
            expectedRevision: String(rev),
            changeMode: "direct",
          }),
        );
        return {
          ...asReceipt("tables.setCellText", raw, body.expectedRevision as string | undefined),
          changeMode: "direct",
          trackedUnsupported: true,
        };
      });
    }),
  );

  app.post(
    "/document/table/row",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      const action = String(body.action || "insert");
      if (action !== "insert" && action !== "delete") {
        throw new MorphError("VALIDATION", "action must be insert or delete", { detail: { action } });
      }
      return getRegistry().mutate(sessionId, `tables.${action}Row`, async (doc) => {
        const inspected = await inspectDocument(doc);
        const ordinal = body.tableOrdinal != null ? Number(body.tableOrdinal) : 0;
        const table = inspected.tables.find((t) => t.tableOrdinal === ordinal) ?? inspected.tables[0];
        if (!table) throw new MorphError("TARGET_NOT_FOUND", "No table in this document");
        const tableNodeId = table.tableNodeId;
        const rowIndex = body.rowIndex != null ? Number(body.rowIndex) : 0;
        const target = tableNodeId
          ? { kind: "block" as const, nodeType: "table" as const, nodeId: tableNodeId }
          : undefined;
        if (!target) {
          throw new MorphError(
            "CAPABILITY_UNAVAILABLE",
            "Engine did not expose a table nodeId. Edit cells with /document/table/cell instead.",
            { detail: { tableOrdinal: table.tableOrdinal, rows: table.rows, cols: table.cols } },
          );
        }
        const position = rowPosition(body.position as string | undefined);
        const raw =
          action === "delete"
            ? await withRevisionRetry(doc, body.expectedRevision as string | undefined, (rev) =>
                doc.tables.deleteRow({
                  target,
                  rowIndex,
                  expectedRevision: String(rev),
                  changeMode: "tracked",
                }),
              )
            : await withRevisionRetry(doc, body.expectedRevision as string | undefined, (rev) =>
                doc.tables.insertRow({
                  target,
                  rowIndex,
                  position,
                  expectedRevision: String(rev),
                  changeMode: "tracked",
                }),
              );
        return asReceipt(`tables.${action}Row`, raw);
      });
    }),
  );

  app.post(
    "/document/format",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      const mark = String(body.mark || body.style || "bold");
      if (!FORMAT_MARKS.has(mark)) {
        throw new MorphError("VALIDATION", "mark must be bold, italic, underline, strike, or highlight", {
          detail: { mark },
        });
      }
      return getRegistry().mutate(sessionId, `format.${mark}`, async (doc) => {
        let target = body.target;
        const pattern = String(body.pattern || body.oldText || "");
        if (!target && pattern) {
          const match = await queryMatch(doc, {
            pattern,
            require: "exactlyOne",
            caseSensitive: body.caseSensitive !== false,
          });
          assertExactlyOne(match, pattern);
          target = match.items[0]?.target;
        }
        if (!target) throw new MorphError("VALIDATION", "target or pattern is required");
        const apply = formatFn(doc, mark);
        const raw = await withRevisionRetry(doc, body.expectedRevision as string | undefined, (rev) =>
          apply({
            target: target as never,
            expectedRevision: String(rev),
            changeMode: "tracked",
            ...(mark === "highlight" && body.color ? { color: String(body.color) } : {}),
          } as never),
        );
        return asReceipt(`format.${mark}`, raw);
      });
    }),
  );

  app.post(
    "/document/list/insert",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      const anchorId = String(body.anchorId || body.blockId || "");
      const content = String(body.content ?? body.text ?? "");
      if (!anchorId) throw new MorphError("INVALID_ANCHOR", "anchorId of an existing list item is required");
      if (!content) throw new MorphError("VALIDATION", "content is required");
      return getRegistry().mutate(sessionId, "lists.insert", async (doc) => {
        const nodeType = await resolveNodeType(doc, anchorId, "listItem");
        if (nodeType !== "listItem" && nodeType !== "paragraph") {
          throw new MorphError("INVALID_ANCHOR", "anchorId must be a list item from inspect.lists", {
            detail: { nodeType },
          });
        }
        const raw = await withRevisionRetry(doc, body.expectedRevision as string | undefined, (rev) =>
          doc.lists.insert({
            target: { kind: "block", nodeType: "listItem", nodeId: anchorId },
            position: body.position === "before" ? "before" : "after",
            text: content,
            expectedRevision: String(rev),
            changeMode: "tracked",
          }),
        );
        return asReceipt("lists.insert", raw);
      });
    }),
  );

  app.post(
    "/document/heading",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      const content = String(body.content ?? body.text ?? "");
      if (!content) throw new MorphError("VALIDATION", "content is required");
      const level = body.level != null ? Number(body.level) : 1;
      if (!Number.isInteger(level) || level < 1 || level > 9) {
        throw new MorphError("INVALID_LEVEL", "level must be an integer 1–9", { detail: { level } });
      }
      if (typeof body.position === "number") {
        throw new MorphError("POSITION_FORBIDDEN", "numeric position is forbidden", { status: 400 });
      }
      return getRegistry().mutate(sessionId, "create.heading", async (doc) => {
        const kind = relativeKind(body.position as string | undefined);
        const anchorId = String(body.anchorId || body.blockId || "");
        if ((kind === "before" || kind === "after") && !anchorId) {
          throw new MorphError("INVALID_ANCHOR", "anchorId is required for relative heading insert");
        }
        const nodeType =
          kind === "before" || kind === "after"
            ? await resolveNodeType(doc, anchorId, "heading")
            : "heading";
        const raw = await withRevisionRetry(doc, body.expectedRevision as string | undefined, (rev) =>
          doc.create.heading({
            at: relativeAt(kind, nodeType, anchorId),
            text: content,
            level,
            expectedRevision: String(rev),
            changeMode: "tracked",
          } as never),
        );
        return asReceipt("create.heading", raw);
      });
    }),
  );
}

function formatFn(doc: { format: Record<string, (params: never) => Promise<unknown>> }, mark: string) {
  const fn = doc.format[mark];
  if (typeof fn !== "function") {
    throw new MorphError("CAPABILITY_UNAVAILABLE", `format.${mark} is not on this engine`);
  }
  return fn.bind(doc.format);
}

function relativeKind(position?: string): "before" | "after" | "documentStart" | "documentEnd" {
  if (position === "before" || position === "firstChild") return "before";
  if (position === "documentStart" || position === "start") return "documentStart";
  if (position === "documentEnd" || position === "end") return "documentEnd";
  return "after";
}
