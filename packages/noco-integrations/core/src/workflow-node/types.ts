import { IntegrationWrapper } from '../integration';
import { AuthIntegration } from '../auth';
import { NocoSDK } from '../sdk';
import { IDataV3Service, ITablesService, IMailService } from './nocodb.interface';
import { WorkflowNodeDefinition, WorkflowNodeCategory, WorkflowNodeCategoryType, VariableDefinition, TriggerActivationType, TriggerTestMode, LoopContext } from 'nocodb-sdk'


export interface WorkflowNodeLog {
  level: 'info' | 'warn' | 'error';
  message: string;
  ts?: number;
  data?: any;
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

export interface NocoDBContext {
  context: NocoSDK.NcContext;
  dataService: IDataV3Service;
  tablesService: ITablesService;
  user: NocoSDK.UserType;
  mailService: IMailService;
  getBaseSchema: () => Promise<any>;
  getAccessToken: () => string;
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
    return this.config._nocodb;
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

  public abstract definition(): Promise<WorkflowNodeDefinition>;

  public async validate(_config: TConfig): Promise<WorkflowNodeValidationResult> {
    return { valid: true };
  }

  public abstract run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult>;

  public async fetchOptions(
    _key: string,
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
}
