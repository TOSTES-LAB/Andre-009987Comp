export type AndrecompSemanticActionId =
  | "search_api"
  | "call_api"
  | "set_task_title"
  | "set_task_monitor"
  | "get_task_context"
  | "get_task_history"
  | "list_documents"
  | "read_document"
  | "list_document_revisions"
  | "report_progress"
  | "answer_status_question"
  | "write_document"
  | "request_human_input"
  | "register_deliverable"
  | "finish_task"
  | "block_task"
  | "request_review"
  | "list_agents"
  | "hire_agent"
  | "get_agent"
  | "search_tasks"
  | "list_approvals"
  | "get_approval"
  | "get_approval_context"
  | "get_workspace_runtime"
  | "control_workspace_service"
  | "reassign_task"
  | "set_dependencies"
  | "create_skill"
  | "update_skill"
  | "get_workspace"
  | "list_workspaces"
  | "select_workspace"
  | "prepare_repository"
  | "create_project"
  | "list_project_repositories"
  | "list_projects"
  | "create_task"
  | "handoff_case"
  | "read_case"
  | "update_case"
  | "create_case"
  | "request_approval"
  | "decide_approval"
  | "comment_on_approval"
  | "schedule_wake";

export type AndrecompSemanticActionPlacement = "always" | "optional";
export type AndrecompSemanticActionMode =
  "standard" | "ask" | "planning" | "skill_test";
export type AndrecompSemanticActionEffect = "read" | "write" | "governance";

export type AndrecompJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly AndrecompJsonValue[]
  | { readonly [key: string]: AndrecompJsonValue };

/** The JSON Schema subset used by the v1 semantic action catalog. */
export interface AndrecompJsonSchema {
  readonly type?: string | readonly string[];
  readonly title?: string;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, AndrecompJsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | AndrecompJsonSchema;
  readonly items?: AndrecompJsonSchema;
  readonly enum?: readonly AndrecompJsonValue[];
  readonly const?: AndrecompJsonValue;
  readonly oneOf?: readonly AndrecompJsonSchema[];
  readonly anyOf?: readonly AndrecompJsonSchema[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly pattern?: string;
  readonly format?: string;
  readonly default?: AndrecompJsonValue;
}

/**
 * A transport-neutral declaration. Catalog membership never grants discovery
 * or invocation authority; a run-scoped authorization layer must do that.
 */
export interface AndrecompSemanticActionDescriptor {
  readonly schema: "andrecomp.semantic-action.v1";
  readonly operationId: AndrecompSemanticActionId;
  readonly version: 1;
  readonly title: string;
  readonly description: string;
  readonly placement: AndrecompSemanticActionPlacement;
  readonly effect: AndrecompSemanticActionEffect;
  readonly requiredClaims: readonly string[];
  readonly allowedModes: readonly AndrecompSemanticActionMode[];
  readonly allowedRoles?: readonly string[];
  readonly inputSchema: AndrecompJsonSchema;
  readonly outputSchema: AndrecompJsonSchema;
}
