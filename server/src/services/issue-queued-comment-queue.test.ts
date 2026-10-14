import { describe, expect, it } from "vitest";
import { buildQueuedCommentQueueSnapshot, decideQueuedCommentQueueSteering, withQueuedCommentIdsInRunContext } from "./issue-queued-comment-queue.js";

describe("decideQueuedCommentQueueSteering", () => {
  it("answers unsupported on the legacy protocol", () => {
    const decision = decideQueuedCommentQueueSteering({
      state: "deferred",
      queueRunRuntimeMode: null,
      activeRun: { id: "run-1", runtimeMode: "legacy" },
      assignedAgentAdapterType: "codex_local",
      queuedCommentCount: 1,
    });

    expect(decision).toEqual({ protocol: "legacy", kind: "unsupported" });
  });

  it("answers temporarily_unavailable for a promoted native queue with no deferred run", () => {
    const decision = decideQueuedCommentQueueSteering({
      state: "queued",
      queueRunRuntimeMode: "native",
      activeRun: null,
      assignedAgentAdapterType: "andrecomp_runner",
      queuedCommentCount: 1,
    });

    expect(decision).toEqual({ protocol: "andrecomp_runner_v1", kind: "temporarily_unavailable" });
  });

  it("answers temporarily_unavailable when the queue holds no live comments", () => {
    const decision = decideQueuedCommentQueueSteering({
      state: "deferred",
      queueRunRuntimeMode: null,
      activeRun: { id: "run-1", runtimeMode: "native" },
      assignedAgentAdapterType: "andrecomp_runner",
      queuedCommentCount: 0,
    });

    expect(decision).toEqual({ protocol: "andrecomp_runner_v1", kind: "temporarily_unavailable" });
  });

  it("tells the caller it may probe a running deferred turn on the native protocol", () => {
    const decision = decideQueuedCommentQueueSteering({
      state: "deferred",
      queueRunRuntimeMode: null,
      activeRun: { id: "run-1", runtimeMode: "native" },
      assignedAgentAdapterType: "andrecomp_runner",
      queuedCommentCount: 1,
    });

    expect(decision).toEqual({ protocol: "andrecomp_runner_v1", kind: "probe", steeringRunId: "run-1" });
  });

  // Acceptance-criterion fact pattern: a deferred queue whose active run
  // has not resolved a runtime mode yet, for an agent on the
  // `andrecomp_runner` adapter. The protocol resolves to
  // `andrecomp_runner_v1` through the adapter-type fallback, and the
  // decision hands the run to the caller to probe live — it never answers
  // the flat "unsupported" value a duplicated, unshared rule can drift to.
  it("resolves the protocol through the adapter-type fallback and asks the caller to probe", () => {
    const decision = decideQueuedCommentQueueSteering({
      state: "deferred",
      queueRunRuntimeMode: null,
      activeRun: { id: "run-1", runtimeMode: null },
      assignedAgentAdapterType: "andrecomp_runner",
      queuedCommentCount: 1,
    });

    expect(decision).toEqual({ protocol: "andrecomp_runner_v1", kind: "probe", steeringRunId: "run-1" });
  });

  it("keeps a preparing Andrecomp Runner on the steering protocol until runtime selection finishes", () => {
    expect(decideQueuedCommentQueueSteering({ state: "deferred", queueRunRuntimeMode: null,
      activeRun: { id: "preparing-run", runtimeMode: "legacy", runtimeModeResolvedAt: null,
        runnerProfileJson: { adapterDispatch: { adapterType: "andrecomp_runner" } } },
      assignedAgentAdapterType: "andrecomp_runner", queuedCommentCount: 1,
    })).toEqual({ protocol: "andrecomp_runner_v1", kind: "temporarily_unavailable" });
  });

  it("preserves the historical adapter when mutable agent settings change", () => {
    expect(decideQueuedCommentQueueSteering({ state: "deferred", queueRunRuntimeMode: null,
      activeRun: { id: "legacy-run", runtimeMode: "legacy", runtimeModeResolvedAt: null,
        runnerProfileJson: { adapterDispatch: { adapterType: "codex_local" } } },
      assignedAgentAdapterType: "andrecomp_runner", queuedCommentCount: 1,
    })).toEqual({ protocol: "legacy", kind: "unsupported" });
  });
});

describe("buildQueuedCommentQueueSnapshot entry permissions", () => {
  const baseFacts = {
    issueId: "issue-1",
    queueId: "queue-1",
    state: "queued" as const,
    activeRunId: null,
    protocol: "legacy" as const,
    steeringDisposition: "unsupported" as const,
  };

  it("grants edit and discard to the user who authored the queued comment", () => {
    const queue = buildQueuedCommentQueueSnapshot({
      ...baseFacts,
      actorType: "user",
      actorId: "user-1",
      comments: [{ id: "comment-1", updatedAt: new Date(), authorUserId: "user-1" }],
    });

    expect(queue.entries[0]?.canEdit).toBe(true);
    expect(queue.entries[0]?.canDiscard).toBe(true);
  });

  it("denies edit and discard to a user who did not author the queued comment", () => {
    const queue = buildQueuedCommentQueueSnapshot({
      ...baseFacts,
      actorType: "user",
      actorId: "user-1",
      comments: [{ id: "comment-1", updatedAt: new Date(), authorUserId: "user-2" }],
    });

    expect(queue.entries[0]?.canEdit).toBe(false);
    expect(queue.entries[0]?.canDiscard).toBe(false);
  });

  it("denies edit and discard to an agent actor even when the comment carries a matching author id", () => {
    const queue = buildQueuedCommentQueueSnapshot({
      ...baseFacts,
      actorType: "agent",
      actorId: "user-1",
      comments: [{ id: "comment-1", updatedAt: new Date(), authorUserId: "user-1" }],
    });

    expect(queue.entries[0]?.canEdit).toBe(false);
    expect(queue.entries[0]?.canDiscard).toBe(false);
  });
});

describe("withQueuedCommentIdsInRunContext", () => {
  it("invalidates every generated task projection and ownership metadata", () => {
    const result = withQueuedCommentIdsInRunContext({
      issueId: "issue-1",
      preserved: "keep",
      andrecompWake: { comments: [{ id: "comment-1" }] },
      andrecompWakeComment: { id: "comment-1" },
      andrecompTaskMarkdown: "historical",
      andrecompTaskMarkdownCompact: "historical compact",
      andrecompTaskMarkdownAssignment: "assignment",
      andrecompTaskMarkdownAssignmentCompact: "assignment compact",
      andrecompTurnContext: { version: 1, events: { owner: "wake_prompt" } },
    }, ["comment-2"], ["source-wake"]);

    expect(result).toMatchObject({
      issueId: "issue-1",
      preserved: "keep",
      queuedCommentSourceWakeIds: ["source-wake"],
      wakeCommentIds: ["comment-2"],
      wakeCommentId: "comment-2",
      commentId: "comment-2",
    });
    expect(result).not.toHaveProperty("andrecompWake");
    expect(result).not.toHaveProperty("andrecompWakeComment");
    expect(result).not.toHaveProperty("andrecompTaskMarkdown");
    expect(result).not.toHaveProperty("andrecompTaskMarkdownCompact");
    expect(result).not.toHaveProperty("andrecompTaskMarkdownAssignment");
    expect(result).not.toHaveProperty("andrecompTaskMarkdownAssignmentCompact");
    expect(result).not.toHaveProperty("andrecompTurnContext");
    expect(withQueuedCommentIdsInRunContext(result, ["comment-3"]).queuedCommentSourceWakeIds).toEqual(["source-wake"]);
  });
});
