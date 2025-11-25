import { IntegrationWrapper } from '../integration';
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
