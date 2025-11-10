import type { Edge, Node } from '@vue-flow/core'
import rfdc from 'rfdc'

const clone = rfdc()

export enum WorkflowCategory {
  ACTION = 'action',
  LOGIC = 'logic',
  TRIGGER = 'trigger',
}

export interface WorkflowNodeType {
  type: string // Unique identifier for the node type (e.g., 'nocodb.create_record', 'core.if_condition')
  label: string
  icon: keyof typeof iconMap
  category: WorkflowCategory
  input?: number
  output?: number
  description?: string
  hidden?: boolean
}

// Map backend WorkflowNodeCategory to UI WorkflowCategory
const categoryMapping: Record<string, WorkflowCategory> = {
  Trigger: WorkflowCategory.TRIGGER,
  Action: WorkflowCategory.ACTION,
  Flow: WorkflowCategory.LOGIC,
}

// Convert backend WorkflowNodeDefinition to UI WorkflowNodeType
function backendNodeToUI(backendNode: any): WorkflowNodeType {
  const inputPorts = backendNode.ports.filter((p) => p.direction === 'input')
  const outputPorts = backendNode.ports.filter((p) => p.direction === 'output')

  return {
    type: backendNode.key,
    label: backendNode.title,
    icon: (backendNode.ui?.icon || 'ncAutomation') as keyof typeof iconMap,
    category: categoryMapping[backendNode.category] || WorkflowCategory.ACTION,
    description: backendNode.description,
    input: inputPorts.length > 0 ? inputPorts.length : undefined,
    output: outputPorts.length > 0 ? outputPorts.length : undefined,
  }
}

// Fallback hardcoded nodes for backward compatibility
const FALLBACK_NODE_TYPES: WorkflowNodeType[] = [
  // Plus Node (special case - not from backend)
  {
    type: 'core.plus',
    label: 'Add Action / Condition',
    icon: 'plus',
    description: 'Add a new action or condition to the workflow',
    category: WorkflowCategory.LOGIC,
    hidden: true,
  },
  // Fallback trigger node (for initial UI rendering)
  {
    type: 'core.trigger',
    label: 'Trigger',
    icon: 'ncAutomation',
    description: 'Start your workflow',
    category: WorkflowCategory.TRIGGER,
    hidden: true,
  },
]

const [useProvideWorkflowStore, useWorkflowStore] = useInjectionState((initialWorkflow?: { nodes: Node[]; edges: Edge[] }) => {
  // Load workflow nodes from backend
  const { workflowNodes, loadWorkflowNodes } = useWorkflowNodes()

  // Reactive workflow node types (backend nodes + special UI nodes)
  const workflowNodeTypes = ref<WorkflowNodeType[]>([...FALLBACK_NODE_TYPES])

  // Initialize workflow nodes
  const initializeNodes = async () => {
    await loadWorkflowNodes()

    // Convert backend nodes to UI format
    const backendUINodes = workflowNodes.value.map(backendNodeToUI)

    // Keep essential fallback nodes that are UI-only (not from backend)
    const plusNode = FALLBACK_NODE_TYPES.find((n) => n.type === 'core.plus')!
    const coreTrigger = FALLBACK_NODE_TYPES.find((n) => n.type === 'core.trigger')!

    workflowNodeTypes.value = [plusNode, coreTrigger, ...backendUINodes]
  }

  // Initialize on mount
  onMounted(() => {
    initializeNodes()
  })

  const getNodeMetaByType = (type?: string) => {
    const node = workflowNodeTypes.value.find((node) => node.type === type)
    return node ? clone(node) : null
  }

  const initNodes = [
    // Trigger node - the first mandatory node in every workflow
    // Start with generic 'core.trigger' so user can select the specific trigger type
    {
      id: self.crypto.randomUUID(),
      type: 'core.trigger',
      position: { x: 250, y: 50 },
      data: {},
    },
  ]

  const nodes = ref<Node[]>(initialWorkflow?.nodes || initNodes)

  const edges = ref<Edge[]>(initialWorkflow?.edges || [])

  const isSaving = ref(false)

  const generateUniqueNodeId = (): string => {
    let candidateId = self.crypto.randomUUID()

    // Keep incrementing until we find an ID that doesn't exist
    while (nodes.value.some((n) => n.id === candidateId)) {
      candidateId = self.crypto.randomUUID()
    }

    return candidateId
  }

  // Callback for layout - will be set by Main.vue
  let layoutCallback: (() => Promise<void>) | null = null

  const setLayoutCallback = (callback: () => Promise<void>) => {
    layoutCallback = callback
  }

  const triggerLayout = async () => {
    if (layoutCallback) {
      await layoutCallback()
    }
  }

  const updateNode = (nodeId: string, updatedData: Partial<Node>) => {
    const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId)
    if (nodeIndex === -1) return

    // Create a new array to trigger reactivity properly
    const updatedNodes = [...nodes.value]
    updatedNodes[nodeIndex] = {
      ...updatedNodes[nodeIndex],
      ...updatedData,
    }
    nodes.value = updatedNodes
  }

  const addPlusNode = (sourceNodeId: string, edgeLabel?: string) => {
    const plusNode: Node = {
      id: generateUniqueNodeId(),
      type: 'core.plus',
      position: { x: 250, y: 200 },
      data: {},
    }

    // Create new array to trigger reactivity
    nodes.value = [...nodes.value, plusNode]

    // Add edge connecting source to plus node
    const edge: Edge = {
      id: `e:${sourceNodeId}->${plusNode.id}`,
      source: sourceNodeId,
      target: plusNode.id,
      animated: true,
    }

    // Add label for conditional branches
    if (edgeLabel) {
      edge.label = edgeLabel
      edge.labelStyle = { fill: '#6b7280', fontWeight: 600, fontSize: 12 }
      edge.labelBgStyle = { fill: 'white' }
    }

    // Create new array to trigger reactivity
    edges.value = [...edges.value, edge]

    return plusNode.id
  }

  const deleteNode = (nodeId: string) => {
    const nodeToDelete = nodes.value.find((n) => n.id === nodeId)
    if (!nodeToDelete) return

    const nodesToDelete = new Set<string>()
    nodesToDelete.add(nodeId)

    // If it's a branch node, find all child nodes recursively
    const nodeTypeMeta = getNodeMetaByType(nodeToDelete.type)
    let firstParentNode: Node | null = null
    if (nodeTypeMeta && nodeTypeMeta.output && nodeTypeMeta.output > 1) {
      const findChildNodes = (parentId: string) => {
        edges.value.forEach((edge) => {
          if (edge.source === parentId) {
            nodesToDelete.add(edge.target)
            findChildNodes(edge.target)
          }
        })
      }
      findChildNodes(nodeId)

      // Also find the first parent node that is not being deleted
      const findFirstParent = (childId: string): Node | null => {
        for (const edge of edges.value) {
          if (edge.target === childId) {
            if (!nodesToDelete.has(edge.source)) {
              return nodes.value.find((n) => n.id === edge.source) || null
            } else {
              return findFirstParent(edge.source)
            }
          }
        }
        return null
      }
      firstParentNode = findFirstParent(nodeId)
    }

    // Connect edges before and after deleted nodes
    const incomingEdges = edges.value.filter((e) => nodesToDelete.has(e.target))
    const outgoingEdges = edges.value.filter((e) => nodesToDelete.has(e.source))

    incomingEdges.forEach((inEdge) => {
      outgoingEdges.forEach((outEdge) => {
        // Create new edge connecting source of inEdge to target of outEdge
        const newEdge: Edge = {
          id: `e:${inEdge.source}->${outEdge.target}`,
          source: inEdge.source,
          target: outEdge.target,
          animated: true,
        }
        edges.value.push(newEdge)
      })
    })

    // Remove nodes
    nodes.value = nodes.value.filter((n) => !nodesToDelete.has(n.id))

    // Remove edges connected to deleted nodes - create new array for reactivity
    edges.value = edges.value.filter((edge) => !nodesToDelete.has(edge.source) && !nodesToDelete.has(edge.target))

    nextTick(() => {
      // Create a new plus node at the position of the first parent node
      if (firstParentNode) {
        addPlusNode(firstParentNode.id)
      }
    })
  }

  /**
   * Serialize workflow to JSON for backend storage
   */
  const serializeWorkflow = () => {
    return {
      nodes: nodes.value,
      edges: edges.value,
    }
  }

  /**
   * Load workflow from serialized data
   */
  const loadWorkflow = (workflowData: { nodes: Node[]; edges: Edge[] }) => {
    nodes.value = workflowData.nodes || []
    edges.value = workflowData.edges || []
  }

  /**
   * Save workflow (will be implemented by parent component with backend API)
   */
  const saveWorkflow = async (saveFn: (data: { nodes: Node[]; edges: Edge[] }) => Promise<void>) => {
    try {
      isSaving.value = true
      const workflowData = serializeWorkflow()
      await saveFn(workflowData)
      message.success('Workflow saved successfully')
    } catch (error) {
      console.error('Failed to save workflow:', error)
      message.error('Failed to save workflow')
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Get all node types
   */
  const getNodeTypes = () => workflowNodeTypes.value

  /**
   * Get node types by category
   */
  const getNodeTypesByCategory = (category: WorkflowCategory) => {
    return workflowNodeTypes.value.filter((node) => node.category === category && !node.hidden)
  }

  /**
   * Get node type metadata by type string
   */
  const getNodeType = (type: string) => {
    return getNodeMetaByType(type)
  }

  return {
    // State
    nodes,
    edges,
    isSaving,
    workflowNodeTypes: readonly(workflowNodeTypes),

    // Methods
    addPlusNode,
    setLayoutCallback,
    triggerLayout,
    serializeWorkflow,
    loadWorkflow,
    saveWorkflow,
    initializeNodes,

    // Node utilities
    updateNode,
    deleteNode,

    // Node types
    getNodeTypes,
    getNodeTypesByCategory,
    getNodeType,
  }
})

export { useProvideWorkflowStore }

export function useWorkflowStoreOrThrow() {
  const state = useWorkflowStore()

  if (!state) {
    throw new Error('useWorkflowStoreOrThrow must be used within a WorkflowStoreProvider')
  }

  return state
}
