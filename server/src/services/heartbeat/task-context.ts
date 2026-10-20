import { createHash } from "node:crypto";
import type { Db, agents, agentTaskSessions, heartbeatRuns, issueComments } from "@andrecomp/db";
import { FAST_RESPONSE_AGENT_GUIDANCE, fastResponseHistoryBody } from "@andrecomp/shared";
import type { AndrecompTurnContext } from "@andrecomp/adapter-utils/server-utils";
import { parseObject } from "../../adapters/utils.js";
import { isConversation } from "../agent-conversations.js";
import { chatCompletionInstruction } from "../chat-completion-delivery.js";
import { getConversationConfirmationContext } from "../conversation-confirmation-context.js";
import { buildExecutionContinuation } from "../execution-continuation.js";
import { getIssueContinuationSummaryDocument } from "../issue-continuation-summary.js";
import type { issueService } from "../issues.js";
import { createRunSecretRedactionRegistry } from "../run-secret-redaction.js";
import { redactQuarantinedBodyForHigherTrust, sanitizeQuarantinedCommentForHigherTrust } from "../source-trust.js";
import { getTaskPlanContext } from "../task-plan-context.js";
import type { TrustPresetResolution } from "../trust-preset-resolver.js";
import { liveVoiceExecutionGuidance } from "../voice/voice-execution-guidance.js";
import { buildAndrecompWakePayload, ANDRECOMP_WAKE_PAYLOAD_KEY, type createHeartbeatRunPreparation } from "./run-preparation.js";
import { buildAndrecompTaskMarkdown } from "./task-markdown.js";

type RunPreparation = ReturnType<typeof createHeartbeatRunPreparation>;
type IssueContext = NonNullable<Awaited<ReturnType<RunPreparation["getIssueExecutionContext"]>>>;

export interface HeartbeatTaskContextInput {
  run: Pick<typeof heartbeatRuns.$inferSelect, "id">;
  agent: Pick<typeof agents.$inferSelect, "id" | "companyId" | "adapterType">;
  task: {
    issueRef: Pick<IssueContext,
      "id" | "identifier" | "title" | "status" | "priority" | "workMode" |
      "conversationAgentId" | "description" | "projectId"> | null;
    issueContext: IssueContext | null;
    wakeCommentContext: Pick<typeof issueComments.$inferSelect,
      "id" | "body" | "sourceTrust" | "presentation" | "metadata"> | null;
    context: Record<string, unknown>;
    taskSession: Pick<typeof agentTaskSessions.$inferSelect, "lastRunId"> | null;
  };
  policy: {
    recovering?: boolean;
    trustPreset: Pick<TrustPresetResolution, "kind">;
    experimentalInstanceSettings: { enableSimplifiedEnglishInteractions?: boolean };
  };
  services: {
    issuesSvc: Pick<ReturnType<typeof issueService>, "getAncestors">;
    getPinnedSkillTestContext: RunPreparation["getPinnedSkillTestContext"];
  };
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** Rebuilds task prompt fields on the run's context; acquires no execution resources. */
export async function prepareHeartbeatTaskContext(db: Db, input: HeartbeatTaskContextInput) {
  const { run, agent } = input;
  const { issueRef, issueContext, wakeCommentContext, context, taskSession } = input.task;
  const { trustPreset, experimentalInstanceSettings } = input.policy;
  const { issuesSvc, getPinnedSkillTestContext } = input.services;
  const continuationSummary = issueRef && !isConversation(issueContext)
    ? await getIssueContinuationSummaryDocument(db, issueRef.id)
    : null;
  const exposeLowTrustRaw = trustPreset.kind === "low_trust_review";
  const safeContinuationSummary =
    continuationSummary && !exposeLowTrustRaw
      ? redactQuarantinedBodyForHigherTrust(continuationSummary)
      : continuationSummary;
  const safeWakeCommentContext =
    wakeCommentContext && !exposeLowTrustRaw
      ? sanitizeQuarantinedCommentForHigherTrust(wakeCommentContext)
      : wakeCommentContext;
  const issueAncestors = issueRef
    ? await issuesSvc.getAncestors(issueRef.id)
    : [];
  if (continuationSummary) {
    context.andrecompContinuationSummary = {
      key: safeContinuationSummary!.key,
      title: safeContinuationSummary!.title,
      body: safeContinuationSummary!.body,
      sourceTrust: safeContinuationSummary!.sourceTrust ?? null,
      updatedAt: safeContinuationSummary!.updatedAt.toISOString(),
    };
  } else {
    delete context.andrecompContinuationSummary;
  }
  const admittedScope = parseObject(context.andrecompAgentJwtScope);
  if (!input.policy.recovering || (admittedScope.kind !== "standard" && admittedScope.kind !== "skill_test")) {
    const savedIssue = parseObject(context.andrecompIssue);
    const skillTest = input.policy.recovering
      ? savedIssue.workMode === "skill_test" || Boolean(context.andrecompSkillTest)
      : issueRef?.workMode === "skill_test";
    context.andrecompAgentJwtScope = skillTest && issueRef
      ? { kind: "skill_test", issueId: issueRef.id }
      : { kind: "standard" };
  }
  const pinnedSkillTestContext =
    issueRef?.workMode === "skill_test"
      ? await getPinnedSkillTestContext(agent.companyId, issueRef.id)
      : null;
  if (pinnedSkillTestContext) {
    context.andrecompSkillTest = {
      ...pinnedSkillTestContext,
      directive:
        "Use this pinned file inventory as the exact skill revision under test, regardless of synced runtime skills.",
    };
  } else {
    delete context.andrecompSkillTest;
  }
  const executionContinuation =
    issueRef && !isConversation(issueContext) && issueContext?.assigneeAgentId === agent.id
      ? await buildExecutionContinuation({
          db,
          companyId: agent.companyId,
          issueId: issueRef.id,
          agentId: agent.id,
          runId: run.id,
          context,
          previousContextRunId: taskSession?.lastRunId,
          summary: safeContinuationSummary?.body ?? null,
          exposeLowTrustRaw,
        })
      : null;
  context.executionContinuation = executionContinuation;
  const andrecompWakePayload = await buildAndrecompWakePayload({
    db,
    companyId: agent.companyId,
    agentId: agent.id,
    runId: run.id,
    contextSnapshot: context,
    continuationSummary,
    issueSummary: issueRef
      ? {
          id: issueRef.id,
          identifier: issueRef.identifier,
          title: issueRef.title,
          description: issueContext?.description ?? null,
          status: issueRef.status,
          priority: issueRef.priority,
          workMode: issueRef.workMode,
          projectId: issueRef.projectId,
          executionPolicy: issueContext?.executionPolicy ?? null,
          originKind: issueContext?.originKind ?? null,
        }
      : null,
    exposeLowTrustRaw,
    simplifiedEnglishInteractions:
      experimentalInstanceSettings.enableSimplifiedEnglishInteractions ===
      true,
  });
  if (andrecompWakePayload) {
    context[ANDRECOMP_WAKE_PAYLOAD_KEY] = andrecompWakePayload;
  } else {
    delete context[ANDRECOMP_WAKE_PAYLOAD_KEY];
  }
  const safeWakeComments = (andrecompWakePayload?.comments ?? []).flatMap(
    (comment) =>
      typeof comment.id === "string" && typeof comment.body === "string"
        ? [
            {
              id: comment.id,
              body: fastResponseHistoryBody({ body: comment.body, origin: typeof comment.origin === "string" ? comment.origin : null }),
              attachments: Array.isArray(comment.attachments)
                ? comment.attachments.flatMap((attachment) => {
                    const descriptor = parseObject(attachment);
                    const id = readNonEmptyString(descriptor.id);
                    const filename = readNonEmptyString(
                      descriptor.filename,
                    );
                    const contentType = readNonEmptyString(
                      descriptor.contentType,
                    );
                    const contentPath = readNonEmptyString(
                      descriptor.contentPath,
                    );
                    const byteSize = descriptor.byteSize;
                    return id &&
                      filename &&
                      contentType &&
                      contentPath &&
                      typeof byteSize === "number"
                      ? [
                          {
                            id,
                            filename,
                            contentType,
                            byteSize,
                            contentPath,
                          },
                        ]
                      : [];
                  })
                : [],
            },
          ]
        : [],
  );
  // Always replace caller-supplied context with the immutable, company-scoped
  // conversation snapshot. It belongs only to the endpoint's assigned agent.
  const liveVoiceGuidance = issueContext?.chatAssignedAgentId === agent.id && issueContext.chatProvider === "speko"
    ? await liveVoiceExecutionGuidance(db, { companyId: agent.companyId, issueId: issueContext.id, agentId: agent.id })
    : null;
  context.andrecompTaskCommunicationGuidance =
    issueContext?.chatAssignedAgentId === agent.id
      ? issueContext.chatCommunicationGuidance
      : null;
  const taskMarkdownInput = {
    conversationConfirmations: issueRef && isConversation(issueContext)
      ? await getConversationConfirmationContext({ db, companyId: agent.companyId, issueId: issueRef.id, agentId: agent.id })
      : null,
    issue: issueRef
      ? {
          id: issueRef.id,
          identifier: issueRef.identifier,
          title: issueRef.title,
          titleNeedsGeneration: issueContext?.titleNeedsGeneration,
          workMode: issueRef.workMode,
          conversationAgentId: issueContext?.conversationAgentId,
          description: issueRef.description,
        }
      : null,
    ancestors: issueAncestors,
    wakeComment: safeWakeCommentContext,
    wakeComments: safeWakeComments,
    attachmentOmissions: andrecompWakePayload?.attachmentOmissions,
    externalChatProvider: andrecompWakePayload?.externalChatProvider,
    slackCommand: issueContext?.chatAssignedAgentId === agent.id
      ? issueContext.chatSlackCommand
      : null,
    nativeRunner: agent.adapterType === "andrecomp_runner",
    interaction: {
      kind: readNonEmptyString(context.interactionKind),
      status: readNonEmptyString(context.interactionStatus),
    },
    planReview: andrecompWakePayload?.planReviewContext?.interaction
      ? {
          status: andrecompWakePayload.planReviewContext.interaction.status,
          reason: andrecompWakePayload.planReviewContext.interaction.result?.reason,
        }
      : null,
    acceptedPlanContinuation:
      readNonEmptyString(context.workspaceRefreshReason) ===
        "accepted_plan_confirmation" &&
      Object.keys(parseObject(context.acceptedPlanWakeRouting)).length ===
        0,
    acceptedPlan: (() => {
      const accepted = parseObject(
        parseObject(context.planReviewInteraction).acceptedTargetRevision,
      );
      const revisionId = readNonEmptyString(accepted.revisionId);
      if (!revisionId) return null;
      return {
        documentId: readNonEmptyString(accepted.documentId),
        revisionId,
        revisionNumber:
          typeof accepted.revisionNumber === "number"
            ? accepted.revisionNumber
            : null,
      };
    })(),
  };
  const taskPlan = issueRef && !isConversation(issueContext)
    ? await getTaskPlanContext({
        db,
        companyId: agent.companyId,
        issueId: issueRef.id,
        approvedRevisionId: taskMarkdownInput.acceptedPlan?.revisionId,
        exposeLowTrustRaw,
      })
    : null;
  // Unlike the frozen initial communication preferences, live-call context
  // must also reach resumed turns. Rebuild it from server records each wake.
  const liveVoiceTaskPrefix = liveVoiceGuidance ? `${liveVoiceGuidance}\n\n` : "";
  let taskMarkdown = liveVoiceTaskPrefix + buildAndrecompTaskMarkdown({ ...taskMarkdownInput, taskPlan }) + chatCompletionInstruction(context);
  let taskMarkdownAssignment = liveVoiceTaskPrefix + buildAndrecompTaskMarkdown({
    ...taskMarkdownInput,
    taskPlan,
    includeWakeComments: false,
  }) + chatCompletionInstruction(context);
  const taskMarkdownCompact = liveVoiceTaskPrefix + buildAndrecompTaskMarkdown({
    ...taskMarkdownInput,
    taskPlan,
    includeDescription: false,
  }) + chatCompletionInstruction(context);
  const taskMarkdownAssignmentCompact = liveVoiceTaskPrefix + buildAndrecompTaskMarkdown({
    ...taskMarkdownInput,
    taskPlan,
    includeDescription: false,
    includeWakeComments: false,
  }) + chatCompletionInstruction(context);
  if (issueRef) {
    context.andrecompIssue = {
      id: issueRef.id,
      identifier: issueRef.identifier,
      title: issueRef.title,
      description: isConversation(issueContext) ? null : issueRef.description,
      workMode: issueRef.workMode,
    };
  } else {
    delete context.andrecompIssue;
  }
  if (wakeCommentContext) {
    context.andrecompWakeComment = safeWakeCommentContext;
  } else {
    delete context.andrecompWakeComment;
  }
  if (taskMarkdown) {
    context.andrecompTaskMarkdown = taskMarkdown;
  } else {
    delete context.andrecompTaskMarkdown;
  }
  if (taskMarkdownAssignment) {
    context.andrecompTaskMarkdownAssignment = taskMarkdownAssignment;
  } else {
    delete context.andrecompTaskMarkdownAssignment;
  }
  if (taskMarkdownCompact && taskMarkdownCompact !== taskMarkdown) {
    context.andrecompTaskMarkdownCompact = taskMarkdownCompact;
  } else {
    delete context.andrecompTaskMarkdownCompact;
  }
  if (taskMarkdownAssignmentCompact && taskMarkdownAssignmentCompact !== taskMarkdownAssignment) {
    context.andrecompTaskMarkdownAssignmentCompact = taskMarkdownAssignmentCompact;
  } else {
    delete context.andrecompTaskMarkdownAssignmentCompact;
  }
  context.andrecompTaskCommunicationGuidance = [context.andrecompTaskCommunicationGuidance, FAST_RESPONSE_AGENT_GUIDANCE].filter(Boolean).join("\n\n");
  if (issueRef) {
    const redactedWakeContext = await createRunSecretRedactionRegistry(
      db,
    ).redactForIssue(agent.companyId, issueRef.id, {
      andrecompIssue: context.andrecompIssue,
      andrecompWakeComment: context.andrecompWakeComment,
      andrecompTaskCommunicationGuidance: context.andrecompTaskCommunicationGuidance,
      andrecompTaskMarkdown: context.andrecompTaskMarkdown,
      andrecompTaskMarkdownCompact: context.andrecompTaskMarkdownCompact,
      andrecompTaskMarkdownAssignment: context.andrecompTaskMarkdownAssignment,
      andrecompTaskMarkdownAssignmentCompact: context.andrecompTaskMarkdownAssignmentCompact,
    });
    context.andrecompIssue = redactedWakeContext.andrecompIssue;
    context.andrecompTaskCommunicationGuidance = redactedWakeContext.andrecompTaskCommunicationGuidance;
    if (redactedWakeContext.andrecompWakeComment) {
      context.andrecompWakeComment =
        redactedWakeContext.andrecompWakeComment;
    }
    if (redactedWakeContext.andrecompTaskMarkdown) {
      context.andrecompTaskMarkdown =
        redactedWakeContext.andrecompTaskMarkdown;
    }
    if (redactedWakeContext.andrecompTaskMarkdownCompact) {
      context.andrecompTaskMarkdownCompact =
        redactedWakeContext.andrecompTaskMarkdownCompact;
    }
    if (redactedWakeContext.andrecompTaskMarkdownAssignment) {
      context.andrecompTaskMarkdownAssignment =
        redactedWakeContext.andrecompTaskMarkdownAssignment;
    }
    if (redactedWakeContext.andrecompTaskMarkdownAssignmentCompact) {
      context.andrecompTaskMarkdownAssignmentCompact =
        redactedWakeContext.andrecompTaskMarkdownAssignmentCompact;
    }
  }
  if (issueRef) {
    const digest = (value: string | null | undefined) =>
      value?.trim()
        ? createHash("sha256")
            .update(value.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ""))
            .digest("hex")
        : null;
    const redactedIssue = parseObject(context.andrecompIssue);
    context.andrecompTurnContext = {
      version: 1,
      assignment: {
        owner: "task_markdown",
        description: {
          id: issueRef.id,
          revision: digest(readNonEmptyString(redactedIssue.description)),
        },
      },
      events: {
        owner: "wake_prompt",
        comments: safeWakeComments.map((comment) => ({
          id: comment.id,
          revision: digest(comment.body),
        })),
      },
    } satisfies AndrecompTurnContext;
  } else {
    delete context.andrecompTurnContext;
  }
  return { continuationSummary, executionContinuation, andrecompWakePayload, safeWakeComments, safeWakeCommentContext };
}
