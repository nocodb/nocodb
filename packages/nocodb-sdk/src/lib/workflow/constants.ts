import { generateRandomUuid } from '~/lib/stringHelpers';
import { WorkflowNodeCategory, WorkflowNodeDefinition } from './node';

export const GeneralNodeID = {
  TRIGGER: 'core.trigger',
  PLUS: 'core.plus',
  NOTE: 'note',
} as const;

/**
 * Trigger activation types determine how triggers are managed when workflow is published/unpublished
 */
export enum TriggerActivationType {
  NONE = 'none', // Manual triggers - no activation needed
  WEBHOOK = 'webhook', // External webhooks (GitHub, GitLab, etc.)
  CRON = 'cron', // Scheduled/cron-based
}

/**
 * Check if a node is a trigger node
 * Trigger nodes include:
 * - core.trigger (generic trigger placeholder)
 * - nocodb.trigger.* (NocoDB-specific triggers)
 * - *.trigger (external service triggers like github.trigger, gitlab.trigger)
 */
export function isTriggerNode(nodeType: string | undefined): boolean {
  if (!nodeType) return false;

  return (
    nodeType === GeneralNodeID.TRIGGER ||
    nodeType.startsWith('nocodb.trigger.') ||
    nodeType.includes('.trigger')
  );
}

export const GENERAL_DEFAULT_NODES: WorkflowNodeDefinition[] = [
  {
    id: GeneralNodeID.PLUS,
    title: 'Add Action / Condition',
    icon: 'ncPlus',
    description: 'Add a new action or condition to the workflow',
    category: WorkflowNodeCategory.ACTION,
    hidden: true,
    ports: [],
  },
  {
    id: GeneralNodeID.TRIGGER,
    title: 'Add Trigger',
    icon: 'ncPlus',
    description: 'Start your workflow',
    category: WorkflowNodeCategory.TRIGGER,
    hidden: true,
    ports: [],
  },
];

const initWorkflowNodes = [
  {
    id: generateRandomUuid(),
    type: GeneralNodeID.TRIGGER,
    position: { x: 250, y: 50 },
    data: {
      title: 'Trigger',
    },
  },
];

export const INIT_WORKFLOW_NODES = initWorkflowNodes;
