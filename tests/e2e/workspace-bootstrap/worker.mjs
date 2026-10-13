// Deterministic process adapter, not a mocked task outcome. The worker must
// actually read the prepared repository and use its run-scoped task API.
import { readFile, readdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const env = process.env;
const headers = { Authorization: `Bearer ${env.ANDRECOMP_API_KEY}`, "X-Andrecomp-Run-Id": env.ANDRECOMP_RUN_ID, "Content-Type": "application/json" };
const api = async (route, method = "GET", body) => {
  const response = await fetch(`${env.ANDRECOMP_API_URL}/api${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  assert(response.ok, `${response.status}: ${await response.clone().text()}`);
  return response.json();
};
const run = await api(`/heartbeat-runs/${env.ANDRECOMP_RUN_ID}`);
assert.equal(run.contextSnapshot.andrecompEnvironment.driver, "local");
const services = run.contextSnapshot.andrecompRuntimeServices;
assert.equal(services.length, 1);
assert.equal(services[0].serviceName, "fixture-web");
assert.equal(run.contextSnapshot.andrecompRuntimePrimaryUrl, services[0].url);
assert.equal(await fetch(services[0].url).then(response => response.text()), "workspace runtime service ready");
const issueId = run.contextSnapshot.issueId;
const issue = await api(`/issues/${issueId}`);
assert.equal(run.contextSnapshot.andrecompIssue.id, issue.id);
assert.equal(run.contextSnapshot.andrecompIssue.description, issue.description);
// The fixture's title equals its description; compact prompts keep the title.
const descriptionSection = `\nIssue description:\n\`\`\`text\n${issue.description}\n\`\`\``;
assert(run.contextSnapshot.andrecompTaskMarkdown.includes(descriptionSection));
assert(run.contextSnapshot.andrecompTaskMarkdownAssignment.includes(descriptionSection));
assert(!run.contextSnapshot.andrecompTaskMarkdownCompact.includes(descriptionSection));
assert(!run.contextSnapshot.andrecompTaskMarkdownAssignmentCompact.includes(descriptionSection));
assert.equal(run.contextSnapshot.andrecompTurnContext.assignment.description.revision,
  createHash("sha256").update(issue.description.trim()).digest("hex"));
const repositories = await readdir(path.join(process.cwd(), ".andrecomp-repositories"));
const repo = path.join(process.cwd(), ".andrecomp-repositories", repositories.find((name) => !name.includes(".clone-")));
assert.equal(await readFile(path.join(repo, "README.md"), "utf8"), "Existing uncommitted work\n");
await assert.rejects(access(path.join(repo, "private.secret")));
await writeFile(path.join(repo, "recovery-proof.txt"), "Workspace recovered; existing work preserved; private files excluded.\n", { flag: "wx" });
await api(`/issues/${issueId}`, "PATCH", { status: "done", comment: "Workspace recovered automatically. I read the preserved uncommitted work, verified private files were excluded, and wrote recovery-proof.txt exactly once." });
console.log("Workspace recovery verification complete.");
