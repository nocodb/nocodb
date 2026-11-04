import { ProjectRoles } from '~/lib/enums';
import type { AgentChannelType } from './channel';
import type { SkillType } from '../skill';
import type { AgentDelivery, AgentSetupState } from './setup';
import type { AgentFileType } from './files';
import type { McpConnectorSource } from '../mcp';

/**
 * What an agent runs on, fixed at creation. A coding agent gets repositories
 * and its own machine per session.
 */
export enum AgentMode {
  STANDARD = 'standard',
  CODING = 'coding',
}

/**
 * An agent's whole behaviour, in one place. There is no second copy and no
 * publish step: what you edit is what runs on the next turn or trigger.
 */
export interface AgentConfigType {
  /** Absent means standard. Set at creation; an update cannot change it. */
  mode?: AgentMode;
  instructions?: string;
  /** ProseMirror JSON behind `instructions`. The prompt always reads `instructions`. */
  instructions_doc?: Record<string, any>;
  starter_prompts?: string[];
  triggers?: AgentTriggerDefinition[];
  /** Falls back to the integration default when unset. */
  model?: string;
  /** Falls back to the workspace default when unset. */
  fk_integration_id?: string;
  /**
   * Tool allowlist, intersected with the role-derived set. Web access is not a
   * separate switch: it is {@link AGENT_WEB_TOOLS} present in this list.
   */
  tools?: string[];
  /**
   * Skill ids enabled for this agent, drawn from its workspace's skill
   * catalog (Enterprise-only). Unlike `tools`, there is no role-derived
   * default — an agent starts with none opted in.
   */
  skills?: string[];
  /** Coding agents: how a run's work comes back as a branch and a pull request. */
  code?: AgentCodeConfig;
  /** A general agent still being set up. Present only while it is a draft. */
  setup?: AgentSetupState;
  /** Where a triggered run's final answer goes. */
  delivery?: AgentDelivery;
  /** Placed in the agent's workspace on every run; instruction chips name them. */
  files?: AgentFileType[];
  /** Tools from app integrations with actions, beyond NocoDB's own. */
  tool_sources?: AgentToolSourceConfig[];
  /**
   * MCP connectors the agent may use. Each person chatting uses their own
   * connection and their own approvals; a triggered run has neither.
   */
  connectors?: AgentConnectorRef[];
}

/** Whether a coding agent's pull request opens as a draft or ready for review. */
export enum AgentPrMode {
  DRAFT = 'draft',
  READY = 'ready',
}

export interface AgentCodeConfig {
  /** Each run's branch; see {@link agentBranchName}. Unset is {@link AGENT_DEFAULT_BRANCH_PATTERN}. */
  branch_pattern?: string;
  /** Unset is draft. */
  pr_mode?: AgentPrMode;
  /** GitHub logins asked to review its pull requests. */
  reviewers?: string[];
}

/** A shared prefix lets a maintainer see at a glance which branches are the agent's, and delete them in one go. */
export const AGENT_DEFAULT_BRANCH_PATTERN = 'nocodb-agent/{slug}';

export const AGENT_MAX_REVIEWERS = 10;

/** A GitHub login: letters, digits and single inner hyphens, at most 39 characters. */
export const GITHUB_LOGIN_PATTERN = /^(?=.{1,39}$)[A-Za-z0-9](?:-?[A-Za-z0-9])*$/;

/** A git branch name: letters, digits, dots, dashes and inner slashes, as git accepts them. */
export function isGitBranchName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 255 &&
    /^[A-Za-z0-9._/-]+$/.test(name) &&
    !/\.\.|\/\/|\/\.|^[/.-]|[/.]$|\.lock$/.test(name)
  );
}

/** Why a branch pattern cannot name a run's branch, or undefined when it can. */
export function agentBranchPatternError(pattern: string): string | undefined {
  if (pattern.length > 100) return 'Keep the branch name under 100 characters.';
  if (!pattern.includes('{slug}'))
    return 'The branch name needs {slug}, which keeps every run on a branch of its own.';

  const literal = pattern.replace(/\{(slug|issue)\}/g, 'x');

  if (/[{}]/.test(literal)) return 'Only {issue} and {slug} are filled in.';
  if (!isGitBranchName(literal)) {
    return 'Use letters, digits, dots, dashes and slashes, with no slash at either end.';
  }

  return undefined;
}

/**
 * A run's branch from its agent's pattern: `{slug}` names the run and keeps it
 * unique, `{issue}` is the issue or pull request it works on. An empty
 * `{issue}` takes its separator with it, so `agent/{issue}-{slug}` gives
 * `agent/<slug>` for a run with no issue.
 */
export function agentBranchName(
  pattern: string | undefined | null,
  vars: { slug: string; issue?: string | null }
): string {
  return (pattern || AGENT_DEFAULT_BRANCH_PATTERN)
    .replace(/\{issue\}/g, vars.issue ?? '')
    .replace(/\{slug\}/g, vars.slug)
    .replace(/[-/.]{2,}/g, (run) =>
      run.includes('/') ? '/' : run.includes('-') ? '-' : '.'
    )
    .replace(/^[-/.]+|[-/.]+$/g, '');
}

export interface AgentConnectorRef {
  source: McpConnectorSource;
  connector_id: string;
}

/** Where an agent's integration tools come from: a provider's actions package run with its auth integration. */
export enum AgentToolSourceKind {
  ACTIONS = 'actions',
}

export interface AgentToolSourceTool {
  /** The tool's own name on its source: an MCP tool name or a capability id. */
  name: string;
  /** Hash of description + input schema when it was picked; a tool that changed since is left out until re-picked. */
  fingerprint?: string;
  /** Runs without asking. Off by default, and ignored when nobody can approve: a triggered run skips tools that would ask. */
  auto_approve?: boolean;
}

export interface AgentToolSourceConfig {
  kind: AgentToolSourceKind;
  fk_integration_id: string;
  tools: AgentToolSourceTool[];
}

/** Whether a model-facing tool name came from a connected service (`<kind>_<id>__<tool>`); MCP connections use `mcp`. */
export function isToolSourceToolName(name: string): boolean {
  return /^(mcp|actions)_.{6}__./.test(name);
}

/** An integration that can be added as a tool source in this base. */
export interface AgentToolSourceCandidate {
  kind: AgentToolSourceKind;
  fk_integration_id: string;
  title: string;
  sub_type: string;
}

/** A tool as its source offers it, for picking. */
export interface AgentToolSourceToolInfo {
  name: string;
  title?: string;
  description: string;
  /** The source's own hint; approval never relies on it. */
  readOnly?: boolean;
  fingerprint: string;
}

/** Granted and revoked as a group by the Web access switch. */
export const AGENT_WEB_TOOLS = ['web_search', 'web_scrape'] as const;

/** Every standard agent's, whatever its allowlist says. The sandbox starts on the first call. */
export const AGENT_COMPUTE_TOOLS = [
  'execute_code',
  'bash',
  'read_file',
  'write_file',
] as const;

/**
 * What a new agent does before anyone configures it. Deliberately plain: it
 * describes the agent's situation rather than giving it a persona, so an author
 * replacing this text is not fighting an invented character.
 */
export const AGENT_DEFAULT_INSTRUCTIONS = `You are a helpful assistant working inside this NocoDB base.

Answer questions about the data using your tools, and say plainly when something \
is outside what your tools can reach. Keep replies short and concrete, and prefer \
values you actually read over anything you remember.`;

/** A new coding agent's. The session prompt already covers the repo and machine. */
export const AGENT_CODING_DEFAULT_INSTRUCTIONS = `Make the change you are asked for, \
keeping it focused and consistent with the code around it. Run the project's \
tests or checks before you finish, and say what you changed and how you checked it.`;

/** What the coding agent creator offers: a first task is an issue, and the work ends in a draft pull request. */
export const AGENT_CODING_ISSUE_INSTRUCTIONS = `Pick up the issue you are given.

1. Reproduce it with a failing test.
2. Fix it with the smallest change that passes.
3. Run the tests and lint.
4. Open a pull request that links the issue and explains the change.

Ask if the issue is unclear. Never merge.`;

/**
 * Roles an agent may hold on its base.  editor is the ceiling.
 */
export const AGENT_ASSIGNABLE_ROLES = [
  ProjectRoles.VIEWER,
  ProjectRoles.COMMENTER,
  ProjectRoles.EDITOR,
] as const;

export type AgentAssignableRole = (typeof AGENT_ASSIGNABLE_ROLES)[number];

export function isAgentAssignableRole(
  role: string
): role is AgentAssignableRole {
  return (AGENT_ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

export interface AgentType {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  title?: string;
  description?: string;
  /** The agent's behaviour. Edited in place — chat and triggers both read this. */
  config?: AgentConfigType;
  /** Owner-controlled pause switch. Triggers require this. */
  enabled?: boolean;
  /** Presentation only (sidebar icon). Never read by the executor. */
  meta?: Record<string, any>;
  /** The sidebar folder this agent sits in, or unset for a top-level agent. */
  fk_agent_section_id?: string | null;
  deleted?: boolean;
  created_by?: string;
  updated_by?: string;
  order?: number;
  created_at?: string;
  updated_at?: string;
  role?: AgentAssignableRole;
  /** Bound reachability surfaces (Slack, Telegram, …) — embedded so the frontend needs no separate fetch. */
  channels?: AgentChannelType[];
  /** `config.skills` resolved against the workspace catalog — embedded so the frontend needs no separate fetch. */
  skills?: SkillType[];
}

export interface AgentCreateReqType {
  title: string;
  description?: string;
  /** Seeded with {@link AGENT_DEFAULT_INSTRUCTIONS} when omitted. */
  config?: AgentConfigType;
  role?: AgentAssignableRole;
  /** False creates it switched off; a draft being set up starts this way. */
  enabled?: boolean;
  meta?: Record<string, any>;
}

export interface AgentUpdateReqType {
  title?: string;
  description?: string;
  /** Applied immediately — there is no separate publish. */
  config?: AgentConfigType;
  enabled?: boolean;
  meta?: Record<string, any>;
  order?: number;
  role?: AgentAssignableRole;
  /** Move between sidebar folders; null lifts the agent back to top level. */
  fk_agent_section_id?: string | null;
}

/** One trigger, embedded in the agent config. Registration derives from the published copy. */
export interface AgentTriggerDefinition {
  id: string;
  /** A workflow trigger node id, e.g. 'core.trigger.cron'. */
  type: string;
  fk_model_id?: string;
  fk_view_id?: string;
  /** The node form's config, opaque here — evaluated by the dispatcher. */
  config?: Record<string, any>;
  /** Default true. Disabled triggers stay in the config but never register. */
  enabled?: boolean;
  /** Coding agents: the repository the run starts on; unset uses the agent's default. */
  fk_repo_id?: string;
}

export function isCodingAgent(
  agent?: Pick<AgentType, 'config'> | null
): boolean {
  return agent?.config?.mode === AgentMode.CODING;
}
export * from './channel';
export * from './setup';
export * from './files';
