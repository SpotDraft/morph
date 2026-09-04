import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { SuperDocClient } from "@superdoc/sdk";

const root = path.resolve(import.meta.dirname, "..");
const fixture = path.join(root, "fixtures", "contract.docx");
spawnSync("python3", [path.join(root, "scripts", "make-fixture.py")], { stdio: "inherit" });

const client = new SuperDocClient({
  defaultChangeMode: "tracked",
  runtime: "v2",
  env: { ...process.env, SUPERDOC_PUBLIC_LICENSE_KEY: process.env.SUPERDOC_PUBLIC_LICENSE_KEY || "morph-spike" },
  requestTimeoutMs: 120_000,
});

await client.connect();
console.log("connected");
const doc = await client.open({ doc: fixture, userName: "Morph Spike", userEmail: "morph@example.com" });
console.log("opened", doc.openResult);
const info = await doc.info();
console.log("info", info.counts, "revision", info.revision);
const match = await doc.query.match({
  select: { type: "text", pattern: "one (1) year", caseSensitive: true },
  require: "exactlyOne",
});
console.log("match total", match.total, "rev", match.evaluatedRevision);
const item = match.items[0];
let receipt = await doc.replace({
  target: item.target,
  text: "two (2) years",
  expectedRevision: match.evaluatedRevision,
  changeMode: "tracked",
} as never);
if ((receipt as { receipt?: { success?: boolean } }).receipt?.success === false) {
  receipt = await doc.replace({
    target: item.target,
    text: "two (2) years",
    expectedRevision: String(doc.openResult.document?.revision ?? 0),
    changeMode: "tracked",
  } as never);
}
console.log("replace", JSON.stringify(receipt, null, 2));
const extract = await doc.extract();
const heading = extract.blocks.find((b) => b.type === "heading" || b.headingLevel);
console.log("heading", heading);
if (heading) {
  const inserted = await doc.create.paragraph({
    at: {
      kind: "before",
      target: { kind: "block", nodeType: (heading.type as "heading") || "heading", nodeId: heading.nodeId },
    },
    text: "CONFIDENTIAL — inserted above heading",
    changeMode: "tracked",
  } as never);
  console.log("insert", inserted);
}
const outDir = await mkdtemp(path.join(os.tmpdir(), "morph-spike-"));
const out = path.join(outDir, "out.docx");
const saved = await doc.save({ out, force: true });
console.log("saved", saved);
await writeFile(path.join(outDir, "ok"), "1");
await doc.close({ discard: true });
await client.dispose();
console.log("spike ok", out);
