import { WorkflowCategory } from 'nocodb-sdk'
import type { Node } from '@vue-flow/core'
interface WorkflowNodeSchema {
  key: string // Unique identifier for the node type (e.g., 'nocodb.create_record', 'core.if_condition')
  title: string // Display name for the node type (e.g., 'NocoDB', 'If')
  ui?: {
    icon?: keyof typeof iconMap
    color?: string
  }
  description?: string
  keywords: Array<string>
  category: WorkflowCategory
  ports: Array<{
    direction: 'input' | 'output'
    id: string
    order: number
  }>
  source: {
    subType: string
    type: 'workflow-node'
  }
}

interface WorkflowNodeType {
  type: string // Unique identifier for the node type (e.g., 'nocodb.create_record', 'core.if_condition')
  title: string // Display name for the node type (e.g., 'NocoDB', 'If')
  icon: keyof typeof iconMap
  category: WorkflowCategory
  input?: number
  output?: number
  description?: string
  hidden?: boolean
}

// Map WorkflowNodeSchema to UI WorkflowCategory
const categoryMapping: Record<string, WorkflowCategory> = {
  Trigger: WorkflowCategory.TRIGGER,
  Action: WorkflowCategory.ACTION,
  Flow: WorkflowCategory.LOGIC,
}

// Convert WorkflowNodeDefinition to UI WorkflowNodeType
function transformNode(backendNode: WorkflowNodeSchema): WorkflowNodeType {
  const inputPorts = backendNode.ports.filter((p: any) => p.direction === 'input')
  const outputPorts = backendNode.ports.filter((p: any) => p.direction === 'output')

  return {
    type: backendNode.key,
    title: backendNode.title,
    icon: (backendNode.ui?.icon || 'ncAutomation') as keyof typeof iconMap,
    category: categoryMapping[backendNode.category] || WorkflowCategory.ACTION,
    description: backendNode.description,
    input: inputPorts.length > 0 ? inputPorts.length : undefined,
    output: outputPorts.length > 0 ? outputPorts.length : undefined,
  }
}

const FALLBACK_NODE_TYPES: WorkflowNodeType[] = [
  {
    type: 'core.plus',
    title: 'Add Action / Condition',
    icon: 'ncPlus',
    description: 'Add a new action or condition to the workflow',
    category: WorkflowCategory.LOGIC,
    hidden: true,
  },
  {
    type: 'core.trigger',
    title: 'Add Trigger',
    icon: 'ncPlus',
    description: 'Start your workflow',
    category: WorkflowCategory.TRIGGER,
    hidden: true,
  },
]

// Trigger node - the first mandatory node in every workflow
// Start with generic 'core.trigger' so user can select the specific trigger type
const initWorkflowNodes = [
  {
    id: crypto.randomUUID(),
    type: 'core.trigger',
    position: { x: 250, y: 50 },
    data: {
      title: 'Trigger',
    },
  },
]

const generateUniqueNodeId = (nodes: Node[]): string => {
  let candidateId = crypto.randomUUID()

  // Keep incrementing until we find an ID that doesn't exist
  while (nodes.some((n) => n.id === candidateId)) {
    candidateId = crypto.randomUUID()
  }

  return candidateId
}

const colorMappingByCategory = {
  [WorkflowCategory.TRIGGER]: themeV4Colors.brand['500'],
  [WorkflowCategory.LOGIC]: themeV4Colors.maroon['500'],
  [WorkflowCategory.CONTROL]: themeV4Colors.brand['500'],
  [WorkflowCategory.ACTION]: themeV4Colors.brand['500'],
}

export type { WorkflowNodeType, WorkflowNodeSchema }

export {
  WorkflowCategory,
  categoryMapping,
  transformNode,
  FALLBACK_NODE_TYPES,
  initWorkflowNodes,
  generateUniqueNodeId,
  colorMappingByCategory,
}
