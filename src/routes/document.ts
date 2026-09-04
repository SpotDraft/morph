import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { checkReferences, findTerm } from "../documents/consistency.js";
import {
  applyAtomic,
  applyReplace,
  assertExactlyOne,
  assertExpectedTextOnMatch,
  buildOutline,
  createComment,
  getBlock,
  queryMatch,
  resolveNodeType,
} from "../documents/query.js";
import { asReceipt, assertReceipt } from "../documents/receipts.js";
import { getRegistry } from "../documents/registry.js";
import { MorphError } from "../errors.js";
import { sessionIdOf, wrap } from "./helpers.js";

export async function documentRoutes(app: FastifyInstance) {
  app.post(
    "/document/query",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      return getRegistry().withDoc(sessionId, async (doc) => {
        const result = await queryMatch(doc, {
          pattern: body.pattern as string | undefined,
          select: body.select as Record<string, unknown> | undefined,
          require: (body.require as "any") ?? "any",
          caseSensitive: Boolean(body.caseSensitive),
          wholeWord: Boolean(body.wholeWord),
          includeDeletedText: Boolean(body.includeDeletedText),
          within: body.within as { nodeId: string; nodeType?: string } | undefined,
          mode: body.mode as "contains" | "regex" | undefined,
        });
        return result;
      });
    }),
  );

  app.post(
    "/document/structure",
    wrap(async (request) => {
      const sessionId = sessionIdOf(request);
      return getRegistry().withDoc(sessionId, async (doc, meta) => {
        const outline = await buildOutline(doc);
        return { docId: meta.sessionId, ...outline };
      });
    }),
  );

  app.post(
    "/document/block",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      const blockId = String(body.blockId || body.nodeId || "");
      if (!blockId) throw new MorphError("VALIDATION", "blockId is required");
      return getRegistry().withDoc(sessionId, (doc) => getBlock(doc, blockId));
    }),
  );

  app.post(
    "/document/extract",
    wrap(async (request) => {
      const sessionId = sessionIdOf(request);
      return getRegistry().withDoc(sessionId, (doc) => doc.extract());
    }),
  );

  app.post(
    "/document/project",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      const mode = (body.reviewMode as "redline" | "final" | "original") || "redline";
      return getRegistry().withDoc(sessionId, async (doc) => {
        if (body.format === "markdown") {
          return doc.projectMarkdown({ reviewMode: mode } as never);
        }
        return doc.projectHtml({ reviewMode: mode, includeSourceMap: Boolean(body.includeSourceMap) } as never);
      });
    }),
  );

  app.post(
    "/document/replace",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      const expectedText = (body.expectedText as string) || (body.expectedContext as string);
      if (body.from != null || body.to != null) {
        throw new MorphError("OFFSET_FORBIDDEN", "from/to targeting is forbidden", { status: 400 });
      }
      return getRegistry().mutate(sessionId, "replace", async (doc) => {
        const pattern = String(body.oldText || body.pattern || "");
        let target = body.target;
        let expectedRevision = body.expectedRevision as string | undefined;
        if (!target && pattern) {
          const match = await queryMatch(doc, {
            pattern,
            require: "exactlyOne",
            caseSensitive: body.caseSensitive !== false,
            wholeWord: Boolean(body.wholeWord),
            within: body.paraId
              ? { nodeId: String(body.paraId), nodeType: "paragraph" }
              : body.blockId
                ? { nodeId: String(body.blockId) }
                : undefined,
          });
          assertExactlyOne(match, pattern);
          target = match.items[0]?.target;
          expectedRevision = expectedRevision ?? match.evaluatedRevision;
          await assertExpectedTextOnMatch(doc, match, expectedText);
        }
        if (!target && !body.ref) {
          throw new MorphError("VALIDATION", "target, ref, or oldText is required");
        }
        const receipt = await applyReplace(doc, {
          target,
          ref: body.ref as string | undefined,
          text: String(body.text ?? body.newText ?? ""),
          expectedRevision,
        });
        return asReceipt("replace", receipt, expectedRevision);
      });
    }),
  );

  app.post(
    "/document/insert",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      if (body.position != null && typeof body.position === "number") {
        throw new MorphError("POSITION_FORBIDDEN", "numeric position is forbidden", { status: 400 });
      }
      return getRegistry().mutate(sessionId, "insert", async (doc) => {
        const kind = (body.atKind as string) || relativeKind(body.position as string | undefined);
        const anchorId = String(body.anchorId || body.afterParaId || body.blockId || "");
        const nodeType =
          (kind === "before" || kind === "after") && anchorId
            ? await resolveNodeType(doc, anchorId, String(body.nodeType || "paragraph"))
            : String(body.nodeType || "paragraph");
        const at =
          kind === "documentStart"
            ? { kind: "documentStart" as const }
            : kind === "documentEnd"
              ? { kind: "documentEnd" as const }
              : {
                  kind: kind as "before" | "after",
                  target: {
                    kind: "block" as const,
                    nodeType: nodeType as "paragraph" | "heading",
                    nodeId: anchorId,
                  },
                };
        if ((kind === "before" || kind === "after") && !anchorId) {
          throw new MorphError("INVALID_ANCHOR", "anchorId is required for relative insert");
        }
        if (body.asListItem) {
          const receipt = await doc.lists.insert({
            at,
            text: String(body.content ?? body.text ?? ""),
            changeMode: "tracked",
            expectedRevision: body.expectedRevision as string | undefined,
            level: body.level as number | undefined,
          } as never);
          return asReceipt("lists.insert", receipt);
        }
        const receipt = await doc.create.paragraph({
          at,
          text: String(body.content ?? body.text ?? ""),
          changeMode: "tracked",
          expectedRevision: body.expectedRevision as string | undefined,
        } as never);
        return asReceipt("create.paragraph", receipt);
      });
    }),
  );

  app.post(
    "/document/delete",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      return getRegistry().mutate(sessionId, "delete", async (doc) => {
        const receipt = await doc.blocks.delete({
          target: body.target as never,
          changeMode: "tracked",
          expectedRevision: body.expectedRevision as string | undefined,
        } as never);
        return asReceipt("blocks.delete", receipt);
      });
    }),
  );

  app.post(
    "/document/mutations/preview",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      return getRegistry().withDoc(sessionId, async (doc) => {
        const preview = await doc.mutations.preview({
          atomic: true,
          steps: (body.steps as never) ?? [],
          expectedRevision: body.expectedRevision as string | undefined,
          changeMode: "tracked",
        } as never);
        return { committed: false, preview };
      });
    }),
  );

  app.post(
    "/document/mutations/apply",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      return getRegistry().mutate(sessionId, "mutations.apply", async (doc) => {
        const receipt = await applyAtomic(doc, {
          steps: (body.steps as unknown[]) ?? [],
          expectedRevision: body.expectedRevision as string | undefined,
          changeMode: (body.changeMode as string) || "tracked",
        });
        return asReceipt("mutations.apply", receipt);
      });
    }),
  );

  app.post(
    "/document/comments",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      return getRegistry().mutate(sessionId, "comments.create", async (doc) => {
        let target = body.target;
        const locator = String(body.phrase || body.oldText || body.selectedText || "");
        if (!target && locator) {
          const match = await queryMatch(doc, {
            pattern: locator,
            require: "exactlyOne",
            caseSensitive: true,
          });
          assertExactlyOne(match, locator);
          target = match.items[0]?.target;
        }
        if (!target) throw new MorphError("VALIDATION", "target or phrase is required to anchor a comment");
        return createComment(doc, { text: String(body.text ?? ""), target });
      });
    }),
  );

  app.get(
    "/document/comments",
    wrap(async (request) => {
      const sessionId = sessionIdOf(request);
      return getRegistry().withDoc(sessionId, (doc) => doc.comments.list());
    }),
  );

  app.get(
    "/document/track-changes",
    wrap(async (request) => {
      const sessionId = sessionIdOf(request);
      return getRegistry().withDoc(sessionId, (doc) => doc.trackChanges.list());
    }),
  );

  app.post(
    "/document/track-changes/decide",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      return getRegistry().mutate(sessionId, "trackChanges.decide", async (doc) => {
        const receipt = await doc.trackChanges.decide({
          decision: body.decision as "accept" | "reject",
          target: body.target as never,
        } as never);
        return asReceipt("trackChanges.decide", receipt);
      });
    }),
  );

  app.post(
    "/document/find-term",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      const term = String(body.term || "");
      if (!term) throw new MorphError("VALIDATION", "term is required");
      return getRegistry().withDoc(sessionId, (doc) => findTerm(doc, term));
    }),
  );

  app.post(
    "/document/check-references",
    wrap(async (request) => {
      const sessionId = sessionIdOf(request);
      return getRegistry().withDoc(sessionId, (doc) => checkReferences(doc));
    }),
  );

  app.post(
    "/export",
    wrap(async (request, reply) => {
      const sessionId = sessionIdOf(request);
      const { bytes, fileName } = await getRegistry().exportArtifact(sessionId);
      reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        .header("Content-Disposition", `attachment; filename="${fileName}"`);
      return reply.send(bytes);
    }),
  );
}

function relativeKind(position?: string): "before" | "after" | "documentStart" | "documentEnd" {
  if (position === "before" || position === "firstChild") return "before";
  if (position === "documentStart" || position === "start") return "documentStart";
  if (position === "documentEnd" || position === "end") return "documentEnd";
  return "after";
}

export function newStepId() {
  return `step-${randomUUID()}`;
}

export { assertReceipt };
