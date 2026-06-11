import { FormDefinition } from '~/lib/formBuilder';
import type { TriggerActivationType, TriggerTestMode } from './constants';

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

  documentation?: string;

  /**
   * Trigger activation type (only for trigger nodes)
   * - NONE: No activation needed (e.g., manual triggers, internal NocoDB triggers)
   * - WEBHOOK: Requires external webhook registration (e.g., GitHub, GitLab)
   * - CRON: Requires scheduling (e.g., cron triggers)
   */
  activationType?: TriggerActivationType;

  /**
   * Supported test modes for this trigger (array, can support multiple)
   * - SAMPLE_DATA: Use sample/mock data
   * - LISTEN_WEBHOOK: Listen for real webhook request
   * - TRIGGER_EVENT: User must trigger event externally
   *
   * If not specified, defaults to [SAMPLE_DATA]
   */
  testModes?: TriggerTestMode[];

  package?: {
    name: string; // e.g., 'github', 'google', 'core', 'nocodb'
    title: string; // e.g., 'GitHub', 'Google', 'Core', 'NocoDB'
    icon?: string; // Package icon
  };

  /**
   * Sub-group within a package for organizing many nodes (mega-menu style).
   * Nodes with the same `group` value are grouped together in the dropdown.
   */
  group?: string; // e.g., 'campaign', 'contact', 'audience'

  /**
   * Human-readable label for the group.
   * If not set, falls back to capitalizing the `group` value.
   */
  groupLabel?: string; // e.g., 'Campaign', 'Contact', 'Audience'

  /**
   * Display order of the group within the package dropdown.
   * Lower numbers appear first.
   */
  groupOrder?: number;
}
