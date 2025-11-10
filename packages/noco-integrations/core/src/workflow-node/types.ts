import { IntegrationWrapper } from '../integration';
import type { FormDefinition } from '../types';

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

export interface WorkflowNodeRunContext<TCustom = Record<string, unknown>> {
  workspaceId?: string;
  baseId?: string;
  user?: {
    id: string;
    email?: string;
  };

  inputs: Record<string, unknown>;

  // Custom payload to pass from the main workflow engine
  custom?: TCustom;

  fetch?: typeof fetch;

  now?: () => Date;
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

export abstract class WorkflowNodeIntegration<TConfig = any> extends IntegrationWrapper<TConfig> {
  public abstract definition(): WorkflowNodeDefinition;

  public async validate(_config: TConfig): Promise<WorkflowNodeValidationResult> {
    return { valid: true };
  }

  public abstract run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult>;
}
