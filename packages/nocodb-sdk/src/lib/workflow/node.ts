import { FormDefinition } from '~/lib/formBuilder';

/**
 * Workflow Categories
 * Used to organize different types of workflow nodes
 */
export const WorkflowNodeCategory = {
  TRIGGER: 'trigger',
  ACTION: 'action',
  FLOW: 'flow',
} as const;

export type WorkflowNodeCategoryType =
  (typeof WorkflowNodeCategory)[keyof typeof WorkflowNodeCategory];

export type WorkflowPortDirection = 'input' | 'output';

export interface WorkflowNodePort {
  id: string; // must be unique per node
  label?: string;
  direction: WorkflowPortDirection;
  order?: number;
}

export interface WorkflowNodeDefinition {
  id: string;

  icon: string;

  title: string;

  description?: string;

  category: WorkflowNodeCategoryType;

  ports: WorkflowNodePort[];

  form?: FormDefinition;

  keywords?: string[];

  hidden?: boolean;
}
