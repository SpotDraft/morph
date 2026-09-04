export interface AgentTool {
  id: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  purpose: string;
  when: string;
  body: Record<string, string>;
  writes: boolean;
}

export const AGENT_TOOLS: AgentTool[] = [
  {
    id: "tools",
    method: "GET",
    path: "/document/tools",
    purpose: "Catalog of every advertised tool plus the agent contract.",
    when: "First call, or after any UNKNOWN_ROUTE / CAPABILITY_UNAVAILABLE.",
    body: {},
    writes: false,
  },
  {
    id: "capacity",
    method: "GET",
    path: "/document/capacity",
    purpose: "Live memory, warm-handle, write-slot, and persist guidance.",
    when: "Planning concurrency or deciding whether to retry an ADMISSION.",
    body: {},
    writes: false,
  },
  {
    id: "inspect",
    method: "POST",
    path: "/document/inspect",
    purpose: "Compact outline, headings, tables (cell nodeIds), lists, comments, revision.",
    when: "First read after upload, and after every mutate. This is how you learn what to edit.",
    body: { sessionId: "required" },
    writes: false,
  },
  {
    id: "query",
    method: "POST",
    path: "/document/query",
    purpose: "Locate text or a node and get a target + evaluatedRevision.",
    when: "Before any single-clause replace. Use require=exactlyOne for a write.",
    body: { sessionId: "required", pattern: "string", require: "exactlyOne|any|first", caseSensitive: "bool" },
    writes: false,
  },
  {
    id: "block",
    method: "POST",
    path: "/document/block",
    purpose: "Full surviving text for one nodeId.",
    when: "You need expectedText for a known block.",
    body: { sessionId: "required", blockId: "nodeId from inspect" },
    writes: false,
  },
  {
    id: "replace",
    method: "POST",
    path: "/document/replace",
    purpose: "Tracked text replace of exactly one match.",
    when: "A unique phrase must change. Send expectedText when you have it.",
    body: { sessionId: "required", oldText: "string", newText: "string", expectedText: "optional" },
    writes: true,
  },
  {
    id: "insert",
    method: "POST",
    path: "/document/insert",
    purpose: "Tracked paragraph insert before/after a nodeId, or at document start/end.",
    when: "Add a clause. Insert-at-top is position=before the first heading, never position=0.",
    body: { sessionId: "required", position: "before|after|documentStart|documentEnd", anchorId: "nodeId", content: "string" },
    writes: true,
  },
  {
    id: "heading",
    method: "POST",
    path: "/document/heading",
    purpose: "Tracked heading insert. Level is 1–9.",
    when: "Add a section title. Anchor with before/after a nodeId.",
    body: { sessionId: "required", content: "string", level: "1-9", position: "before|after|documentStart|documentEnd", anchorId: "nodeId" },
    writes: true,
  },
  {
    id: "replace-all",
    method: "POST",
    path: "/replace-all",
    purpose: "Visible match set plus one atomic rewrite.",
    when: "The same literal must change everywhere. Inspect matches before trusting the write.",
    body: { sessionId: "required", search: "string", replace: "string", excludeBlockIds: "optional string[]" },
    writes: true,
  },
  {
    id: "table.cell",
    method: "POST",
    path: "/document/table/cell",
    purpose: "Tracked set of one table cell's text via the cell nodeId.",
    when: "inspect.tables shows the cell. Prefer rowIndex+columnIndex or the cell nodeId.",
    body: { sessionId: "required", rowIndex: "number", columnIndex: "number", text: "string", tableOrdinal: "optional" },
    writes: true,
  },
  {
    id: "table.row",
    method: "POST",
    path: "/document/table/row",
    purpose: "Tracked insert or delete of a table row.",
    when: "inspect.tables has a tableNodeId or you have a row index on tableOrdinal 0.",
    body: { sessionId: "required", action: "insert|delete", tableOrdinal: "number", rowIndex: "number", position: "before|after" },
    writes: true,
  },
  {
    id: "format",
    method: "POST",
    path: "/document/format",
    purpose: "Apply bold/italic/underline/strike/highlight to a queried span.",
    when: "The words already exist and only marks should change.",
    body: { sessionId: "required", mark: "bold|italic|underline|strike|highlight", pattern: "unique text" },
    writes: true,
  },
  {
    id: "list.insert",
    method: "POST",
    path: "/document/list/insert",
    purpose: "Insert a list item. Never type the number prefix — the engine owns numbering.",
    when: "Add a numbered/bulleted item next to an existing list item nodeId from inspect.lists.",
    body: { sessionId: "required", anchorId: "list item nodeId", position: "before|after", content: "string" },
    writes: true,
  },
  {
    id: "comment",
    method: "POST",
    path: "/document/comments",
    purpose: "Anchor a comment to a phrase. Labeled direct — engine cannot track comment create.",
    when: "Leave a note, not a redline.",
    body: { sessionId: "required", text: "string", phrase: "unique text" },
    writes: true,
  },
  {
    id: "export",
    method: "POST",
    path: "/export",
    purpose: "Download a distinct DOCX. Does not delete the session.",
    when: "The agent or human needs the Word file.",
    body: { sessionId: "required" },
    writes: false,
  },
  {
    id: "find-term",
    method: "POST",
    path: "/document/find-term",
    purpose: "Definition block plus occurrences for a defined term.",
    when: "Planning a defined-term consistency pass. Do not treat this as a write locator.",
    body: { sessionId: "required", term: "Supplier" },
    writes: false,
  },
];

export function agentLoop() {
  return "upload → POST /document/inspect → query or block → mutate → inspect again → export. Keep sessionId. Never send from/to or a numeric position.";
}

export function agentContract() {
  return {
    targeting: "query.match target, nodeId from inspect, or before/after a nodeId. Never from/to or numeric position.",
    success: "receipt.success plus last-good persist. Facade success equals receipt.success.",
    retry: "Retry only 429/503 (and honor Retry-After). 404 is session expiry. 400 is a targeting/precondition bug — fix the request.",
    afterMutate: "Re-call /document/inspect. Addresses and revisions are stale after any write.",
    changeMode: "Writes are tracked unless the receipt says changeMode=direct.",
    errors: "Every failure has code, detail, retryable, retryAfter, nextAction. There is no bare 500.",
    loop: agentLoop(),
  };
}
