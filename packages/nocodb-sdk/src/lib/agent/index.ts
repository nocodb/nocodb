import { ProjectRoles } from '~/lib/enums';
import type { AgentChannelType } from './channel';
import type { SkillType } from '../skill';

export * from './message';
export * from './session';

/**
 * An agent's whole behaviour, in one place. There is no second copy and no
 * publish step: what you edit is what runs on the next turn or trigger.
 */
export interface AgentConfigType {
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
   * Tool allowlist, intersected with the role-derived set. Web access and
   * Compute are not separate switches: they are {@link AGENT_WEB_TOOLS} and
   * {@link AGENT_COMPUTE_TOOLS} present in this list.
   */
  tools?: string[];
  /**
   * Skill ids enabled for this agent, drawn from its workspace's skill
   * catalog (Enterprise-only). Unlike `tools`, there is no role-derived
   * default — an agent starts with none opted in.
   */
  skills?: string[];
}

/** Granted and revoked as a group by the Web access switch. */
export const AGENT_WEB_TOOLS = ['web_search', 'web_scrape'] as const;

/** Granted and revoked as a group by the Compute switch. */
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
}
export * from './channel';
