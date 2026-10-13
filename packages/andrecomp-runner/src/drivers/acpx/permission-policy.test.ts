import { describe, expect, it } from "vitest";
import { capabilityCanonicalOperationsForSurface } from "../../catalog/canonical-operations.js";

import {
  acpxRuntimePermissionPolicy,
  claudeAndrecompPermissionRules,
  decideAcpxPermission,
} from "./permission-policy.js";

describe("ACPX permission policy", () => {
  it.each(["approve-reads", "approve-andrecomp"] as const)("allows assigned canonical live reads, including approval lookup, in %s", mode => {
    const reads = capabilityCanonicalOperationsForSurface("live").filter(action => action.sideEffectClass === "read");
    expect(reads.some(action => action.operationId === "get_approval")).toBe(true);
    for (const action of reads) {
      expect(claudeAndrecompPermissionRules([{ name: action.operationId }], mode)).toEqual([`mcp__andrecomp__${action.operationId}`]);
    }
    expect(claudeAndrecompPermissionRules([{ name: "get_approval" }], "deny-all")).toEqual([]);
  });
  it("uses only catalogued reads assigned to this run, regardless of tool hints", () => {
    const tools = [
      "andrecomp__get_task_context", "read_document", "write_document",
      "call_api", "request_approval", "unknown_read", "mcp__other__get_task_context",
    ].map((name) => ({ name, annotations: { readOnlyHint: true, effect: "read" } }));
    expect(claudeAndrecompPermissionRules(tools, "approve-reads")).toEqual([
      "mcp__andrecomp__get_task_context", "mcp__andrecomp__read_document",
    ]);
    expect(claudeAndrecompPermissionRules([], "approve-reads")).toEqual([]);
  });

  it("allows assigned Andrecomp mutations without admitting unknown or external tools", () => {
    const tools = ["andrecomp__write_document", "create_task", "reassign_task", "request_approval",
      "write_document", "mcp__other__create_task", "Bash", "unknown_write", "mcp__andrecomp__create_task",
      "decide_approval", "control_workspace_service", "call_api", "create_skill", "schedule_wake"]
      .map(name => ({ name, annotations: { readOnlyHint: true } }));
    expect(claudeAndrecompPermissionRules(tools, "approve-andrecomp")).toEqual([
      "mcp__andrecomp__create_task", "mcp__andrecomp__reassign_task",
      "mcp__andrecomp__request_approval", "mcp__andrecomp__write_document",
    ]);
    expect(claudeAndrecompPermissionRules([], "approve-andrecomp")).toEqual([]);
    expect(claudeAndrecompPermissionRules(tools, "deny-all")).toEqual([]);
  });

  it("maps each configured mode to a closed ACP runtime policy", () => {
    expect(acpxRuntimePermissionPolicy("approve-all")).toEqual({
      defaultAction: "approve",
    });
    expect(acpxRuntimePermissionPolicy("deny-all")).toEqual({
      defaultAction: "deny",
    });
    expect(acpxRuntimePermissionPolicy("approve-andrecomp")).toEqual({ defaultAction: "escalate" });
    expect(acpxRuntimePermissionPolicy("approve-reads")).toEqual({
      defaultAction: "escalate",
    });
  });

  it.each(["approve-reads", "approve-andrecomp"] as const)("requires repository acquisition approval in %s", (mode) => {
    const tools = ["prepare_repository", "andrecomp__prepare_repository", "mcp__andrecomp__prepare_repository"]
      .map(name => ({ name, annotations: { readOnlyHint: true, effect: "read" } }));
    expect(claudeAndrecompPermissionRules(tools, mode)).toEqual([]);
    expect(decideAcpxPermission("claude", mode, {
      inferredKind: "read",
      raw: { toolCall: { name: "mcp__andrecomp__prepare_repository" } },
    })).toBe("delegate");
  });

  it.each([
    ["approve-all", "execute", "allow_once"],
    ["approve-reads", "read", "delegate"],
    ["approve-reads", "search", "delegate"],
    ["approve-reads", "execute", "delegate"],
    ["approve-andrecomp", "read", "delegate"],
    ["approve-andrecomp", "write", "delegate"],
    ["approve-andrecomp", "execute", "delegate"],
    ["deny-all", "read", "reject_once"],
  ] as const)("%s maps %s to %s", (mode, inferredKind, expected) => {
    expect(
      decideAcpxPermission("claude", mode, { inferredKind, raw: {} }),
    ).toBe(expected);
  });

  it("keeps deny-all closed against provider-supplied semantic metadata", () => {
    for (const [agent, raw] of [
      ["claude", { toolCall: { name: "mcp__andrecomp__andrecomp_finish" } }],
      ["claude", { toolCall: { rawInput: { serverName: "andrecomp" } } }],
      [
        "codex",
        {
          _meta: { is_mcp_tool_approval: true },
          toolCall: { title: "MCP approval" },
        },
      ],
    ] as const) {
      expect(
        decideAcpxPermission(
          agent,
          "deny-all",
          { inferredKind: "execute", raw },
          { allConfiguredMcpServersAreRunnerOwned: true },
        ),
      ).toBe("reject_once");
    }
  });

  it.each(["approve-reads", "approve-andrecomp"] as const)("does not let provider metadata widen %s", (mode) => {
    for (const [agent, inferredKind, raw, options] of [
      [
        "codex",
        "execute",
        {
          _meta: { is_mcp_tool_approval: true },
          toolCall: { title: "MCP approval" },
        },
        { allConfiguredMcpServersAreRunnerOwned: true },
      ],
      [
        "claude",
        "write",
        { toolCall: { rawInput: { serverName: "andrecomp" } } },
        {},
      ],
      [
        "claude",
        "execute",
        { toolCall: { name: "mcp__andrecomp__andrecomp_finish" } },
        {},
      ],
      [
        "claude",
        "write",
        {
          toolCall: {
            _meta: {
              claudeCode: { toolName: "mcp.andrecomp.get_task_context" },
            },
          },
        },
        {},
      ],
    ] as const) {
      expect(
        decideAcpxPermission(
          agent,
          mode,
          { inferredKind, raw },
          options,
        ),
      ).toBe("delegate");
    }
  });

  it("does not trust provider-originated read classifications", () => {
    for (const inferredKind of ["read", "search", "list", "READ"]) {
      expect(
        decideAcpxPermission("codex", "approve-reads", {
          inferredKind,
          raw: {
            _meta: { is_mcp_tool_approval: true },
            toolCall: {
              name: "mcp__andrecomp__get_task_context",
              rawInput: { serverName: "andrecomp" },
            },
          },
        }),
      ).toBe("delegate");
    }
  });
});
