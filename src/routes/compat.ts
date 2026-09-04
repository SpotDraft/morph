import type { FastifyInstance } from "fastify";
import {
  applyAtomic,
  applyReplace,
  assertExactlyOne,
  assertExpectedTextOnMatch,
  buildOutline,
  createComment,
  queryMatch,
  replaceAllSteps,
  resolveNodeType,
} from "../documents/query.js";
import { asReceipt, assertReceipt } from "../documents/receipts.js";
import { getRegistry } from "../documents/registry.js";
import { MorphError } from "../errors.js";
import { sessionIdOf, wrap } from "./helpers.js";

export async function compatRoutes(app: FastifyInstance) {
  app.post(
    "/search",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      const phrase = String(body.phrase || body.pattern || "");
      if (!phrase) throw new MorphError("VALIDATION", "phrase is required");
      return getRegistry().withDoc(sessionId, async (doc) => {
        const match = await queryMatch(doc, {
          pattern: phrase,
          require: "any",
          caseSensitive: true,
          includeDeletedText: false,
        });
        const results = (match.items ?? []).map((item) => {
          const rec = item as {
            snippet?: string;
            address?: { nodeId?: string };
            target?: unknown;
          };
          return {
            blockId: rec.address?.nodeId,
            snippet: rec.snippet,
            target: rec.target,
            range: undefined,
          };
        });
        return { results, count: match.total ?? results.length, evaluatedRevision: match.evaluatedRevision };
      });
    }),
  );

  app.post(
    "/get-content",
    wrap(async (request) => {
      const sessionId = sessionIdOf(request);
      return getRegistry().withDoc(sessionId, async (doc) => {
        const [extract, html, outline] = await Promise.all([
          doc.extract(),
          doc.projectHtml({ reviewMode: "redline" } as never).catch(() => null),
          buildOutline(doc),
        ]);
        return {
          text: extract.blocks.map((b) => b.text).join("\n"),
          html,
          paragraphs: outline.blocks,
          comments: extract.comments,
          trackedChanges: extract.trackedChanges,
        };
      });
    }),
  );

  app.post(
    "/replace",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      if (body.from != null || body.to != null) {
        throw new MorphError("OFFSET_FORBIDDEN", "from/to targeting is forbidden; use query or paragraph tools", {
          status: 400,
        });
      }
      throw new MorphError("OFFSET_FORBIDDEN", "Use /document/replace or /replace-in-paragraph", { status: 400 });
    }),
  );

  app.post(
    "/insert-content",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      if (typeof body.position === "number") {
        throw new MorphError("POSITION_FORBIDDEN", "numeric position is forbidden; use afterParaId", {
          status: 400,
        });
      }
      if (!body.afterParaId && !body.anchorId) {
        throw new MorphError("POSITION_FORBIDDEN", "insert-content requires afterParaId or a structural at", {
          status: 400,
        });
      }
      return insertAfter(request);
    }),
  );

  app.post("/replace-in-paragraph", wrap(replaceInParagraph));
  app.post("/insert-after-paragraph", wrap(insertAfter));

  app.post(
    "/replace-all",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      const search = String(body.search || "");
      const replace = String(body.replace ?? "");
      if (!search) throw new MorphError("VALIDATION", "search is required");
      return getRegistry().mutate(sessionId, "replace-all", async (doc) => {
        const match = await queryMatch(doc, {
          pattern: search,
          require: "any",
          caseSensitive: body.caseSensitive !== false,
          wholeWord: Boolean(body.wholeWord),
        });
        const excludeIds = new Set(
          ([] as string[])
            .concat((body.excludeBlockIds as string[]) || [])
            .concat(
              ((body.exclusions as Array<{ blockId?: string }>) || [])
                .map((e) => e.blockId)
                .filter((id): id is string => Boolean(id)),
            ),
        );
        const visible = (match.items ?? []).map((item) => ({
          blockId: item.address?.nodeId,
          snippet: item.snippet,
          ref: item.handle?.ref,
          address: item.address,
        }));
        const { chosen, excluded, steps } = replaceAllSteps(
          search,
          replace,
          match.items ?? [],
          excludeIds,
          {
            caseSensitive: body.caseSensitive !== false,
            wholeWord: Boolean(body.wholeWord),
          },
        );
        if (steps.length === 0) {
          return {
            ok: true,
            committed: false,
            matches: visible,
            excluded,
            results: [],
            replaced: 0,
          };
        }
        const receipt = await applyAtomic(doc, {
          steps,
          expectedRevision: match.evaluatedRevision,
          changeMode: "tracked",
        });
        const ok = asReceipt("replace-all", receipt);
        assertReceipt(ok);
        return {
          ok: true,
          success: true,
          committed: true,
          matches: visible,
          excluded,
          results: chosen.map((m) => ({ blockId: m.address?.nodeId, ok: true })),
          replaced: steps.length,
          receipt: ok,
        };
      });
    }),
  );

  app.post(
    "/add-comment",
    wrap(async (request) => {
      const body = request.body as Record<string, unknown>;
      const sessionId = sessionIdOf(request);
      if ((body.selection as { from?: unknown } | undefined)?.from != null) {
        throw new MorphError("OFFSET_FORBIDDEN", "selection.from/to is forbidden; pass target or phrase", {
          status: 400,
        });
      }
      return getRegistry().mutate(sessionId, "add-comment", async (doc) => {
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
        return createComment(doc, {
          text: String(body.text || body.comment || ""),
          target,
        });
      });
    }),
  );

  app.get(
    "/get-comments",
    wrap(async (request) => {
      const sessionId = sessionIdOf(request);
      return getRegistry().withDoc(sessionId, (doc) => doc.comments.list());
    }),
  );
}

async function replaceInParagraph(request: { body?: unknown }) {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const sessionId = String(body.sessionId || "");
  const paraId = String(body.paraId || "");
  const oldText = String(body.oldText || "");
  const newText = String(body.newText ?? "");
  if (!paraId) throw new MorphError("VALIDATION", "paraId is required");
  if (!oldText) throw new MorphError("VALIDATION", "oldText is required");
  return getRegistry().mutate(sessionId, "replace-in-paragraph", async (doc) => {
    const match = await queryMatch(doc, {
      pattern: oldText,
      require: "exactlyOne",
      caseSensitive: true,
      within: { nodeId: paraId, nodeType: "paragraph" },
    });
    assertExactlyOne(match, oldText);
    await assertExpectedTextOnMatch(doc, match, body.expectedContext as string | undefined);
    const receipt = await applyReplace(doc, {
      target: match.items[0]?.target,
      text: newText,
      expectedRevision: match.evaluatedRevision,
    });
    const ok = asReceipt("replace-in-paragraph", receipt);
    return {
      success: true,
      paraId,
      replacedText: newText,
      matchCount: 1,
      receipt: ok,
    };
  });
}

async function insertAfter(request: { body?: unknown }) {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const sessionId = String(body.sessionId || "");
  const afterParaId = String(body.afterParaId || body.anchorId || "");
  const content = String(body.content ?? body.text ?? "");
  if (!afterParaId) throw new MorphError("VALIDATION", "afterParaId is required");
  return getRegistry().mutate(sessionId, "insert-after-paragraph", async (doc) => {
    const nodeType = await resolveNodeType(doc, afterParaId, "paragraph");
    const receipt = await doc.create.paragraph({
      at: {
        kind: "after",
        target: { kind: "block", nodeType: nodeType as "paragraph", nodeId: afterParaId },
      },
      text: content,
      changeMode: "tracked",
    } as never);
    return asReceipt("insert-after-paragraph", receipt);
  });
}

