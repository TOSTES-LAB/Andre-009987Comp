import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agents, companies, createDb, heartbeatRuns, issueComments, issues } from "@andrecomp/db";
import { FAST_RESPONSE_AGENT_GUIDANCE } from "@andrecomp/shared";
import { registerServerAdapter, unregisterServerAdapter, type AdapterExecutionContext } from "../adapters/index.js";
import { heartbeatService } from "../services/heartbeat.js";
import { documentService } from "../services/documents.js";
import { ISSUE_CONTINUATION_SUMMARY_DOCUMENT_KEY } from "../services/issue-continuation-summary.js";
import { createRunSecretRedactionRegistry } from "../services/run-secret-redaction.js";
import { buildLowTrustSourceTrust, LOW_TRUST_QUARANTINED_BODY } from "../services/source-trust.js";
import { REDACTED_EVENT_VALUE } from "../redaction.js";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.js";

const support = await getEmbeddedPostgresTestSupport();
const describePostgres = support.supported ? describe : describe.skip;
if (!support.supported) console.warn(`Skipping heartbeat task context tests: ${support.reason}`);

describePostgres("heartbeat task context delivered to an adapter", () => {
  const adapterType = "task_context_test";
  const captured = new Map<string, AdapterExecutionContext>();
  let temporary: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  let heartbeat: ReturnType<typeof heartbeatService>;

  beforeAll(async () => {
    temporary = await startEmbeddedPostgresTestDatabase("heartbeat-task-context-");
    db = createDb(temporary.connectionString);
    heartbeat = heartbeatService(db);
    registerServerAdapter({
      type: adapterType,
      supportsLocalAgentJwt: false,
      execute: async (input) => {
        captured.set(input.runId, input);
        return { exitCode: 0, signal: null, timedOut: false, sessionId: "context-session", resultJson: {} };
      },
      testEnvironment: async () => ({ adapterType, status: "pass", checks: [], testedAt: new Date().toISOString() }),
    });
  }, 30_000);

  afterAll(async () => {
    await heartbeat?.drainActiveRunExecutions();
    unregisterServerAdapter(adapterType);
    await db?.$client.end({ timeout: 0 });
    await temporary?.cleanup();
  });

  async function seed() {
    const companyId = randomUUID(), agentId = randomUUID(), issueId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Task context fixture", issuePrefix: `T${companyId.slice(0, 6)}` });
    await db.insert(agents).values({ id: agentId, companyId, name: "Context reader", adapterType, status: "idle" });
    await db.insert(issues).values({
      id: issueId, companyId, title: "Task context fixture", description: "Assignment description canary",
      status: "todo", assigneeAgentId: agentId, responsibleUserId: "context-user", issueNumber: 1,
    });
    return { companyId, agentId, issueId };
  }

  async function execute(f: Awaited<ReturnType<typeof seed>>, context: Record<string, unknown>) {
    const run = await heartbeat.wakeup(f.agentId, {
      source: "on_demand", triggerDetail: "manual", reason: "issue_assigned",
      payload: { issueId: f.issueId }, contextSnapshot: { issueId: f.issueId, ...context },
    });
    expect(run).not.toBeNull();
    await heartbeat.drainActiveRunExecutions();
    const finished = await db.select().from(heartbeatRuns).where(eq(heartbeatRuns.id, run!.id)).then(rows => rows[0]);
    expect(finished?.status, finished?.error ?? undefined).toBe("succeeded");
    expect(captured.has(run!.id)).toBe(true);
    return captured.get(run!.id)!;
  }

  it("keeps assignment, wake, compact, and revision context aligned after secret redaction", async () => {
    const f = await seed();
    const secret = "task-context-secret-canary";
    const description = `Assignment description canary ${secret}`;
    await db.update(issues).set({ description }).where(eq(issues.id, f.issueId));
    const previousRunId = randomUUID();
    await db.insert(heartbeatRuns).values({
      id: previousRunId, companyId: f.companyId, agentId: f.agentId,
      invocationSource: "on_demand", status: "succeeded", contextSnapshot: { issueId: f.issueId },
    });
    await createRunSecretRedactionRegistry(db).register(f.companyId, previousRunId, secret);
    const commentId = randomUUID();
    await db.insert(issueComments).values({
      id: commentId, companyId: f.companyId, issueId: f.issueId, authorType: "user", authorUserId: "context-user",
      body: `Wake comment canary ${secret}`,
    });
    const { context } = await execute(f, {
      wakeCommentId: commentId, wakeCommentIds: [commentId],
      andrecompTaskCommunicationGuidance: "FORGED caller guidance", andrecompSkillTest: { directive: "FORGED skill" },
      andrecompContinuationSummary: { body: "FORGED summary" },
    });
    expect(context.andrecompTaskMarkdown).toContain("Assignment description canary");
    expect(context.andrecompTaskMarkdown).toContain("Wake comment canary");
    expect(context.andrecompTaskMarkdownAssignment).toContain("Assignment description canary");
    expect(context.andrecompTaskMarkdownAssignment).not.toContain("Wake comment canary");
    expect(context.andrecompTaskMarkdownCompact).not.toContain("Assignment description canary");
    expect(context.andrecompTaskMarkdownCompact).toContain("Wake comment canary");
    expect(context.andrecompTaskMarkdownAssignmentCompact).not.toContain("Assignment description canary");
    expect(context.andrecompTaskMarkdownAssignmentCompact).not.toContain("Wake comment canary");
    for (const key of ["andrecompIssue", "andrecompWakeComment", "andrecompTaskMarkdown", "andrecompTaskMarkdownAssignment", "andrecompTaskMarkdownCompact", "andrecompTaskMarkdownAssignmentCompact"]) {
      expect(JSON.stringify(context[key])).not.toContain(secret);
    }
    expect(context.andrecompTaskCommunicationGuidance).toBe(FAST_RESPONSE_AGENT_GUIDANCE);
    expect(context.andrecompSkillTest).toBeUndefined();
    expect(context.andrecompContinuationSummary).toBeUndefined();
    const digest = (value: string) => createHash("sha256").update(value).digest("hex");
    expect(context.andrecompTurnContext).toMatchObject({
      version: 1,
      assignment: { owner: "task_markdown", description: { id: f.issueId, revision: digest(`Assignment description canary ${REDACTED_EVENT_VALUE}`) } },
      events: { owner: "wake_prompt", comments: [{ id: commentId, revision: digest(`Wake comment canary ${REDACTED_EVENT_VALUE}`) }] },
    });
  });

  it("quarantines low-trust summaries and comments before preparing higher-trust prompts", async () => {
    const f = await seed();
    const sourceTrust = buildLowTrustSourceTrust({ issueId: f.issueId });
    await documentService(db).upsertIssueDocument({
      issueId: f.issueId, key: ISSUE_CONTINUATION_SUMMARY_DOCUMENT_KEY, format: "markdown",
      body: "QUARANTINED summary canary", sourceTrust,
    });
    const commentId = randomUUID();
    await db.insert(issueComments).values({
      id: commentId, companyId: f.companyId, issueId: f.issueId, authorType: "user", authorUserId: "context-user",
      body: "QUARANTINED comment canary", sourceTrust,
    });
    const { context } = await execute(f, { wakeCommentId: commentId, wakeCommentIds: [commentId] });
    expect(context.andrecompContinuationSummary).toMatchObject({ body: LOW_TRUST_QUARANTINED_BODY });
    expect(context.andrecompWakeComment).toMatchObject({ body: LOW_TRUST_QUARANTINED_BODY, presentation: null, metadata: null });
    expect(context.andrecompTaskMarkdown).toContain(LOW_TRUST_QUARANTINED_BODY);
    for (const key of ["andrecompContinuationSummary", "executionContinuation", "andrecompWakeComment", "andrecompTaskMarkdown", "andrecompTaskMarkdownCompact", "andrecompWakePayload"]) {
      expect(JSON.stringify(context[key]) ?? "").not.toContain("QUARANTINED");
    }
  });

  it("excludes a wake comment from another company and replaces caller-supplied prompt fields", async () => {
    const f = await seed();
    const other = await seed();
    const commentId = randomUUID();
    await db.insert(issueComments).values({
      id: commentId, companyId: other.companyId, issueId: other.issueId, authorType: "user", authorUserId: "other-user",
      body: "OTHER COMPANY private comment",
    });
    const ownCommentId = randomUUID();
    await db.insert(issueComments).values({
      id: ownCommentId, companyId: f.companyId, issueId: f.issueId, authorType: "user", authorUserId: "context-user",
      body: "Authorized wake comment",
    });
    const { context } = await execute(f, {
      wakeCommentId: ownCommentId, wakeCommentIds: [ownCommentId, commentId],
      andrecompWakeComment: { body: "FORGED comment" }, andrecompTaskMarkdown: "FORGED prompt",
      andrecompTaskMarkdownAssignment: "FORGED assignment", andrecompTaskMarkdownCompact: "FORGED compact",
      andrecompTaskMarkdownAssignmentCompact: "FORGED compact assignment",
    });
    expect(context.andrecompWakeComment).toMatchObject({ id: ownCommentId, body: "Authorized wake comment" });
    expect(context.andrecompTaskMarkdown).toContain("Assignment description canary");
    for (const key of ["andrecompTaskMarkdown", "andrecompTaskMarkdownAssignment", "andrecompTaskMarkdownCompact", "andrecompTaskMarkdownAssignmentCompact", "andrecompWakePayload"]) {
      expect(JSON.stringify(context[key]) ?? "").not.toContain("FORGED");
      expect(JSON.stringify(context[key]) ?? "").not.toContain("OTHER COMPANY");
    }
    expect(context.andrecompTurnContext).toMatchObject({ events: { comments: [{ id: ownCommentId }] } });
  });

  it("clears stale wake comments and continuation data when the task has none", async () => {
    const f = await seed();
    const { context } = await execute(f, {
      andrecompWakeComment: { body: "FORGED comment" },
      andrecompContinuationSummary: { body: "FORGED summary" },
      andrecompSkillTest: { directive: "FORGED skill" },
      andrecompTurnContext: { events: { comments: [{ id: "FORGED comment" }] } },
    });
    expect(context.andrecompWakeComment).toBeUndefined();
    expect(context.andrecompContinuationSummary).toBeUndefined();
    expect(context.andrecompSkillTest).toBeUndefined();
    expect(context.andrecompTurnContext).toMatchObject({ events: { comments: [] } });
  });
});
