import { WorkflowNodeCategory, WorkflowNodeDefinition } from './node';

export const GeneralNodeID = {
  TRIGGER: 'core.trigger',
  PLUS: 'core.plus',
} as const;

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
    id: crypto.randomUUID(),
    type: GeneralNodeID.TRIGGER,
    position: { x: 250, y: 50 },
    data: {
      title: 'Trigger',
    },
  },
];

export const INIT_WORKFLOW_NODES = initWorkflowNodes;
