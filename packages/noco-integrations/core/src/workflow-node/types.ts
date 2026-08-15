import { IntegrationWrapper } from '../integration';
import { NocoSDK } from '../sdk';
import type { NocoDBContext } from '../nocodb';
import { WorkflowNodeDefinition, WorkflowNodeCategory, WorkflowNodeCategoryType, VariableDefinition, TriggerActivationType, TriggerTestMode, LoopContext } from 'nocodb-sdk'


export interface WorkflowNodeLog {
  level: 'info' | 'warn' | 'error';
  message: string;
  ts?: number;
  data?: any;
}

export type ExternalQueryClient =
  | 'pg'
  | 'mysql2'
  | 'mssql'
  | 'oracledb'
  | 'snowflake'
  | 'databricks';

export interface ExternalQueryParams {
  client: ExternalQueryClient;
  connection: Record<string, unknown>;
  query: string | string[];
  /**
   * Applied only on the `raw` path with a single statement — an array `query`
   * runs statement by statement with no bindings.
   */
  bindings?: readonly unknown[];
  /** Driver response instead of the row array, where rows lose information. */
  raw?: boolean;
}

export interface ExternalQueryResult {
  rows: Record<string, unknown>[];
  /** Set instead of `rows` when the driver response is not a row array. */
  rawResponse?: unknown;
}

export type ExecuteExternalQuery = (
  params: ExternalQueryParams,
) => Promise<ExternalQueryResult>;

/** Catch to fall back to the node's own client. */
export class ExternalQueryUnavailableError extends Error {
  public readonly code = 'EXTERNAL_QUERY_UNAVAILABLE';

  constructor(
    message = 'Pooled SQL executor is not available in this deployment.',
  ) {
    super(message);
    this.name = 'ExternalQueryUnavailableError';
  }
}

export interface WorkflowNodeRunContext<TConfig = any> {
  workspaceId: string;
  baseId: string;
  testMode?: boolean;
  user?: {
    id: string;
    email?: string;
    display_name?: string;
  };
  inputs: {
    config: TConfig;
    title?: string;
  };
  /**
   * Load an integration by ID (AI, Auth, or any other integration type).
   * Returns an Integration wrapper containing the integration.
   *
   * @param integrationId - The ID of the integration to load
   * @returns Promise resolving to Integration wrapper
   *
   * @example
   * ```typescript
   * // Loading an Auth integration
   * const auth = await ctx.getIntegration(config.authIntegrationId);
   * const data = await auth.use(async (client) => {
   *   return client.api.getData();
   * });
   *
   * // Loading an AI integration with type
   * const ai = await ctx.getIntegration<AiIntegration>(config.aiIntegrationId);
   * const result = await integration.generateText({ prompt: 'Hello' });
   * ```
   */
  getIntegration?: <T = any>(
    integrationId: string
  ) => Promise<T>;
  executeExternalQuery?: ExecuteExternalQuery;
}

/**
 * Context provided when activating external webhook triggers
 */
export interface WorkflowActivationContext {
  /** The webhook URL that external services should call */
  webhookUrl: string;
  /** Workflow ID */
  workflowId: string;
  /** Trigger node ID in the workflow */
  nodeId: string;
}

/**
 * State returned from onActivateHook that will be passed to onDeactivateHook
 * Store any data needed for cleanup (e.g., external webhook IDs, secrets)
 */
export type WorkflowActivationState = Record<string, any>;

/**
 * Context provided to poll() method for polling-based triggers
 */
export interface PollingContext {
  /** Workflow ID */
  workflowId: string;
  /** Trigger node ID in the workflow */
  nodeId: string;
  /** Previous cursor/state from last successful poll (null on first poll) */
  previousCursor: Record<string, any> | null;
  /** When this poll was scheduled (ISO string) */
  scheduledTime: string;
}

/**
 * Result from poll() method containing detected items and updated cursor
 */
export interface PollingResult {
  /** New items detected since last poll */
  items: any[];
  /** Updated cursor/state for next poll (e.g., lastId, timestamp, etag) */
  cursor: Record<string, any>;
  /** Optional: Override default batch behavior for this poll ('single' = one workflow per item, 'batch' = all items in single workflow) */
  batchMode?: 'single' | 'batch';
}

export interface WorkflowNodeResult {
  outputs: Record<string, unknown>;

  metrics?: Record<string, number>;

  logs?: WorkflowNodeLog[];

  status?: 'success' | 'pending' | 'skipped' | 'error' | 'running';

  error?: { message: string; code?: string; data?: any };

  loopContext?: LoopContext;
}

export interface WorkflowNodeValidationResult {
  valid: boolean;
  errors?: { path?: string; message: string }[];
  warnings?: { path?: string; message: string }[];
}

export interface WorkflowNodeConfig {
  _nocodb: NocoDBContext;
}

export {
  WorkflowNodeCategory,
  WorkflowNodeCategoryType,
  WorkflowNodeDefinition,
  TriggerActivationType,
  TriggerTestMode,
}

export abstract class WorkflowNodeIntegration<TConfig extends WorkflowNodeConfig = WorkflowNodeConfig> extends IntegrationWrapper<TConfig> {
  protected get nocodb(): NocoDBContext {
    return this._config._nocodb;
  }

  /**
   * Stored integration loader function from execution context.
   * Set by the workflow executor before node execution.
   * @internal
   */
  protected _integrationLoader?: <T = any>(
    integrationId: string
  ) => Promise<T>;

  /**
   * Set the integration loader function for this node instance.
   * Called by the workflow executor before node execution.
   * @internal
   */
  public setIntegrationLoader(
    loader: <T = any>(integrationId: string) => Promise<T>
  ) {
    this._integrationLoader = loader;
  }

  /**
   * Load an integration by ID (AI, Auth, or any other integration type).
   * Use this in run(), fetchOptions(), or other methods that need to access integrations.
   *
   * @param integrationId - The ID of the integration to load
   * @returns Promise resolving to AuthIntegration wrapper containing the integration
   * @throws Error if integration loader is not available
   *
   * @example
   * ```typescript
   * // Loading an Auth integration
   * async run(ctx: WorkflowNodeRunContext) {
   *   const auth = await this.getIntegration(this.config.authIntegrationId);
   *   const data = await auth.use(async (client) => {
   *     return client.api.getData();
   *   });
   * }
   *
   * // Loading an AI integration with type
   * async run(ctx: WorkflowNodeRunContext) {
   *   const ai = await this.getIntegration<AiIntegration>(this.config.aiIntegrationId);
   *   const result = await ai.generateText({ prompt: 'Hello' });
   * }
   * ```
   */
  protected async getIntegration<T = any>(
    integrationId: string
  ): Promise<T> {
    if (!this._integrationLoader) {
      throw new Error('Integration loader not available. This node must be executed within a workflow context.');
    }
    return this._integrationLoader<T>(integrationId);
  }

  /**
   * Stored pooled SQL executor from execution context.
   * Set by the workflow executor before node execution, and left unset by
   * hosts that have no SQL executor to offer.
   * @internal
   */
  protected _externalQueryExecutor?: ExecuteExternalQuery;

  /**
   * Set the pooled SQL executor for this node instance.
   * Called by the workflow executor before node execution.
   * @internal
   */
  public setExternalQueryExecutor(executor: ExecuteExternalQuery) {
    this._externalQueryExecutor = executor;
  }

  /**
   * Whether the host provided the pooled SQL executor. Branch on this to pick
   * the pooled path without going through a thrown error.
   */
  protected get hasExternalQueryExecutor(): boolean {
    return typeof this._externalQueryExecutor === 'function';
  }

  /**
   * Execute SQL against an external database through the platform's pooled SQL
   * executor instead of opening a pool the node then has to tear down.
   *
   * @param params - Client, connection config, statement(s) and bindings
   * @returns Promise resolving to the rows the statement produced
   * @throws ExternalQueryUnavailableError if the host provided no executor
   *
   * @example
   * ```typescript
   * async run(_ctx: WorkflowNodeRunContext) {
   *   if (this.hasExternalQueryExecutor) {
   *     const { rows } = await this.executeExternalQuery({
   *       client: 'pg',
   *       connection: this.connectionConfig,
   *       query: 'select * from users limit 10',
   *     });
   *     return { outputs: { rows } };
   *   }
   *   return { outputs: { rows: await this.queryWithOwnClient() } };
   * }
   * ```
   */
  protected async executeExternalQuery(
    params: ExternalQueryParams,
  ): Promise<ExternalQueryResult> {
    if (!this._externalQueryExecutor) {
      throw new ExternalQueryUnavailableError();
    }
    return this._externalQueryExecutor(params);
  }

  public abstract definition(): Promise<WorkflowNodeDefinition>;

  public async validate(_config: TConfig): Promise<WorkflowNodeValidationResult> {
    return { valid: true };
  }

  public abstract run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult>;

  public async fetchOptions(
    _key: string,
    _searchQuery?: string,
  ): Promise<unknown> {
    return []
  }

  /**
   * Generate input variables from node configuration
   * Called when config changes (e.g., table selected)
   * Optional - implement if node has configurable inputs
   *
   * @param context - Variable generator context with database access and node graph
   * @param runtimeInputs - Optional runtime data with interpolated config and actual outputs
   */
  public async generateInputVariables?(
    context: NocoSDK.VariableGeneratorContext,
    runtimeInputs?: any,
  ): Promise<VariableDefinition[]>;

  /**
   * Generate output variables from node definition
   * Called after node definition or test execution
   * Optional - implement if node produces structured output
   *
   * @param context - Variable generator context with database access and node graph
   * @param runtimeInputs - Optional runtime data with interpolated config and actual outputs
   */
  public async generateOutputVariables?(
    context: NocoSDK.VariableGeneratorContext,
    runtimeInputs?: any,
  ): Promise<VariableDefinition[]>;

  /**
   * Called when workflow is published/enabled
   * Use for: registering webhooks, establishing connections, subscribing to events
   *
   * @param context - Activation context with webhook URL and workflow info
   * @returns State object that will be passed to onDeactivateHook for cleanup
   *
   * @example GitHub webhook
   * ```typescript
   * async onActivateHook(context: WorkflowActivationContext) {
   *   const auth = await this.getIntegration<AuthIntegration>(this.config.authIntegrationId);
   *   const webhook = await auth.use(async (client) => {
   *     return client.repos.createWebhook({
   *       owner: this.config.owner,
   *       repo: this.config.repo,
   *       config: { url: context.webhookUrl, content_type: 'json' },
   *       events: this.config.events,
   *     });
   *   });
   *   return { webhookId: webhook.data.id, createdAt: Date.now() };
   * }
   * ```
   */
  public async onActivateHook?(
    context: WorkflowActivationContext
  ): Promise<WorkflowActivationState | void>;

  /**
   * Called when workflow is unpublished/disabled
   * Use for: cleanup, unregistering webhooks, closing connections
   *
   * @param context - Same context from activation
   * @param state - The state object returned from onActivateHook()
   *
   * @example GitHub webhook cleanup
   * ```typescript
   * async onDeactivateHook(context: WorkflowActivationContext, state?: WorkflowActivationState) {
   *   if (!state?.webhookId) return;
   *   const auth = await this.getIntegration<AuthIntegration>(this.config.authIntegrationId);
   *   await auth.use(async (client) => {
   *     await client.repos.deleteWebhook({
   *       owner: this.config.owner,
   *       repo: this.config.repo,
   *       hook_id: state.webhookId,
   *     });
   *   });
   * }
   * ```
   */
  public async onDeactivateHook?(
    context: WorkflowActivationContext,
    state?: WorkflowActivationState
  ): Promise<void>;

  public async heartbeat?(
    context: WorkflowActivationContext,
    state?: WorkflowActivationState
  ): Promise<WorkflowActivationState>;

  /**
   * Called on schedule for polling-based triggers to check for new items.
   * Must return detected items and updated cursor state.
   *
   * @param context - Polling context with previous cursor state
   * @returns Items to trigger workflows and updated cursor
   *
   * @example RSS Feed Polling
   * ```typescript
   * async poll(context: PollingContext): Promise<PollingResult> {
   *   const feed = await this.fetchRssFeed(this.config.feedUrl);
   *   const lastSeenGuid = context.previousCursor?.lastGuid;
   *
   *   const newItems = feed.items.filter(item =>
   *     !lastSeenGuid || item.guid > lastSeenGuid
   *   );
   *
   *   return {
   *     items: newItems,
   *     cursor: { lastGuid: feed.items[0]?.guid },
   *   };
   * }
   * ```
   */
  public async poll?(context: PollingContext): Promise<PollingResult>;
}
