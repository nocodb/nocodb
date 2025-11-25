import { IntegrationWrapper } from '../integration';
import { AuthIntegration } from '../auth';
import { NocoSDK } from '../sdk';
import { IDataV3Service, ITablesService } from './nocodb.interface';
import { WorkflowNodeDefinition, WorkflowNodeCategory, WorkflowNodeCategoryType, VariableDefinition } from 'nocodb-sdk'


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
   * Load an auth integration by ID for making authenticated API calls.
   * Returns an AuthIntegration instance with automatic token refresh.
   *
   * @param integrationId - The ID of the integration to load
   * @returns Promise resolving to the AuthIntegration instance
   *
   * @example
   * ```typescript
   * const auth = await ctx.getAuthIntegration(config.authIntegrationId);
   * const data = await auth.use(async (client) => {
   *   return client.api.getData();
   * });
   * ```
   */
  getAuthIntegration?: <T = any, U = any>(
    integrationId: string
  ) => Promise<AuthIntegration<T, U>>;
}

export interface WorkflowNodeResult {
  outputs: Record<string, unknown>;

  metrics?: Record<string, number>;

  logs?: WorkflowNodeLog[];

  status?: 'success' | 'partial' | 'skipped' | 'error';

  error?: { message: string; code?: string; data?: any };
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
}

export interface WorkflowNodeConfig {
  _nocodb: NocoDBContext;
}

export {
  WorkflowNodeCategory,
  WorkflowNodeCategoryType,
  WorkflowNodeDefinition
}

export abstract class WorkflowNodeIntegration<TConfig extends WorkflowNodeConfig = WorkflowNodeConfig> extends IntegrationWrapper<TConfig> {
  protected get nocodb(): NocoDBContext {
    return this.config._nocodb;
  }

  /**
   * Stored auth loader function from execution context.
   * Set by the workflow executor before node execution.
   * @internal
   */
  protected _authLoader?: <T = any, U = any>(
    integrationId: string
  ) => Promise<AuthIntegration<T, U>>;

  /**
   * Set the auth loader function for this node instance.
   * Called by the workflow executor before node execution.
   * @internal
   */
  public setAuthLoader(
    loader: <T = any, U = any>(integrationId: string) => Promise<AuthIntegration<T, U>>
  ) {
    this._authLoader = loader;
  }

  /**
   * Load an auth integration by ID for making authenticated API calls.
   * Use this in run(), fetchOptions(), or other methods that need authentication.
   *
   * @param integrationId - The ID of the integration to load
   * @returns Promise resolving to the AuthIntegration instance
   * @throws Error if auth loader is not available
   *
   * @example
   * ```typescript
   * async run(ctx: WorkflowNodeRunContext) {
   *   const auth = await this.getAuthIntegration(this.config.authIntegrationId);
   *   const data = await auth.use(async (client) => {
   *     return client.api.getData();
   *   });
   * }
   * ```
   */
  protected async getAuthIntegration<T = any, U = any>(
    integrationId: string
  ): Promise<AuthIntegration<T, U>> {
    if (!this._authLoader) {
      throw new Error('Auth loader not available. This node must be executed within a workflow context.');
    }
    return this._authLoader<T, U>(integrationId);
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
   */
  public async generateInputVariables?(): Promise<VariableDefinition[]>;

  /**
   * Generate output variables from node definition
   * Called after node definition or test execution
   * Optional - implement if node produces structured output
   */
  public async generateOutputVariables?(): Promise<VariableDefinition[]>;
}
