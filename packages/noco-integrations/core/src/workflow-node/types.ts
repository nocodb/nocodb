import { IntegrationWrapper } from '../integration';
import { NocoSDK } from '../sdk';
import type { FormDefinition } from '../types';
import { IDataV3Service, ITablesService } from './nocodb.interface';

export enum WorkflowNodeCategory {
  ACTION = 'Action',
  TRIGGER = 'Trigger',
  FLOW = 'Flow',
}

export type WorkflowPortDirection = 'input' | 'output';

export interface WorkflowNodePort {
  id: string; // must be unique per node
  label?: string;
  direction: WorkflowPortDirection;
  order?: number;
}

export interface WorkflowNodeUI {
  icon?: string;
  color?: string;
}

export interface WorkflowNodeDefinition {
  key: string;

  title: string;

  description?: string;

  category: WorkflowNodeCategory;

  ports: WorkflowNodePort[];

  form?: FormDefinition;

  ui?: WorkflowNodeUI;

  keywords?: string[];
}

export interface WorkflowNodeLog {
  level: 'info' | 'warn' | 'error';
  message: string;
  ts?: number;
  data?: any;
}

export interface WorkflowNodeRunContext<T = any> {
  workspaceId?: string;
  baseId?: string;
  user?: {
    id: string;
    email?: string;
  };

  inputs: T;
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
}

export interface WorkflowNodeConfig {
  _nocodb: NocoDBContext;
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
}
