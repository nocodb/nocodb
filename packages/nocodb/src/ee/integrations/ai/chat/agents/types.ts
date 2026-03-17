/**
 * Shared types for the multi-agent chat system.
 */

import type { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';

export type { ToolVisibility } from '~/integrations/ai/chat/tools/define-chat-tool';

export type SchemaDepth = 'none' | 'high-level' | 'full' | 'focused';

/** Model quality tier — maps to provider-specific model IDs via the AI integration's modelMap. */
export type ModelTier = 'high' | 'medium' | 'low';

/** Prompt params shared by all specialist agents. */
export interface SpecialistPromptParams {
  /** Schema context (depth varies by agent) */
  schemaContext: string;
  /** Current base name */
  baseName?: string;
  /** User roles */
  userRoles: { workspaceRole: string; baseRole: string | null };
  /** Turn summaries from prior agents */
  turnSummaries?: string[];
  /** Focused instruction from router */
  routerInstruction?: string;
}

/** Prompt params for the router agent. */
export interface RouterPromptParams {
  /** High-level schema: table names, primary columns, relationships */
  schemaContext: string;
  /** Current base name (if any) */
  baseName?: string;
  /** Summaries from previous agent hops in this turn */
  turnSummaries?: string[];
  /** Sliding window of recent agent names */
  agentHistory?: string[];
  /** User roles */
  userRoles: { workspaceRole: string; baseRole: string | null };
}

export type AgentPromptParams = RouterPromptParams | SpecialistPromptParams;

export interface AgentDefinition {
  /** Unique agent identifier */
  name: string;

  /** Human-readable description — router uses this to decide which agent to dispatch */
  description: string;

  /** Tool names from ChatToolRegistry that this agent can use.
   *  The orchestrator auto-injects `return_to_router` for all specialists. */
  tools: ChatToolName[];

  /** Max streamText steps (tool-call loops) for this agent */
  maxTurns: number;

  /** How much base schema to inject into this agent's system prompt */
  schemaDepth: SchemaDepth;

  /** Model quality tier for this agent — controls cost/capability trade-off.
   *  Maps to provider-specific model IDs via the AI integration's modelMap. */
  modelTier: ModelTier;

  /** Build the system prompt for this agent with dynamic context. */
  buildPrompt(params: AgentPromptParams): string;
}
