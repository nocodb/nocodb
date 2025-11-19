import type { WorkflowNodeCategoryType, WorkflowType } from 'nocodb-sdk'
import { GENERAL_DEFAULT_NODES, GeneralNodeID, INIT_WORKFLOW_NODES } from 'nocodb-sdk'
import type { Edge, Node } from '@vue-flow/core'
import rfdc from 'rfdc'
import { transformNode } from '~/utils/workflowUtils'

const clone = rfdc()

const [useProvideWorkflow, useWorkflow] = useInjectionState((workflow: ComputedRef<WorkflowType>) => {
  const { isUIAllowed } = useRoles()

  const { api } = useApi()

  const workflowStore = useWorkflowStore()

  const baseStore = useBases()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { activeBaseNodeSchemas } = storeToRefs(workflowStore)

  const { activeProjectId } = storeToRefs(baseStore)

  const { updateWorkflow } = workflowStore

  const isSidebarOpen = ref(true)

  const selectedNodeId = ref<string | null>(null)

  const isSaving = ref(false)

  const nodeTypes = computed(() => {
    return [...GENERAL_DEFAULT_NODES, ...activeBaseNodeSchemas.value.map(transformNode)]
  })

  const nodes = ref<Array<Node>>((workflow.value?.nodes || INIT_WORKFLOW_NODES) as Array<Node>)

  const edges = ref<Array<Edge>>((workflow.value?.edges as Array<Edge>) || [])

  const hasManualTrigger = computed(() => {
    return nodes.value.some((node) => node.type === 'core.trigger.manual')
  })

  const selectedNode = computed(() => {
    if (!selectedNodeId.value) return null
    return nodes.value.find((n) => n.id === selectedNodeId.value)
  })

  const getNodeMetaById = (id?: string) => {
    const node = nodeTypes.value.find((node) => node.id === id)
    return node ? clone(node) : null
  }

  const updateWorkflowData = async (
    { description, nodes, edges }: { description?: string; nodes?: Array<Node>; edges?: Array<Edge> },
    skipNetworkCall: boolean = true,
  ) => {
    if (!activeProjectId.value || !workflow.value?.id) return

    if (isUIAllowed('workflowCreateOrEdit')) {
      isSaving.value = true
      try {
        await updateWorkflow(
          activeProjectId.value,
          workflow.value.id,
          {
            description,
            nodes,
            edges,
          },
          {
            skipNetworkCall,
          },
        )
      } finally {
        isSaving.value = false
      }
    }
  }

  const debouncedWorkflowUpdate = useDebounceFn(async () => {
    if (!activeProjectId.value || !workflow.value?.id) return
    await updateWorkflowData(
      {
        description: workflow.value.description,
        nodes: nodes.value,
        edges: edges.value,
      },
      false,
    )
  }, 500)

  const updateSelectedNode = (nodeId: string, openSidebar = true) => {
    selectedNodeId.value = nodeId
    isSidebarOpen.value = openSidebar
  }

  // Callback for layout - will be set by Main.vue
  let layoutCallback: (() => Promise<void>) | null = null

  const setLayoutCallback = (callback: () => Promise<void>) => {
    layoutCallback = callback
  }

  const triggerLayout = async () => {
    await nextTick()
    if (layoutCallback) {
      await layoutCallback()
    }
  }

  /**
   * Generate a unique node title based on the node type title
   * E.g., 'NocoDB', 'NocoDB1', 'NocoDB2', etc.
   */
  const generateUniqueNodeTitle = (nodeId: string): string => {
    const nodeTypeMeta = getNodeMetaById(nodeId)
    if (!nodeTypeMeta) return 'Untitled'

    const baseTitle = nodeTypeMeta.title

    // Get all existing node titles that start with this base title
    const existingTitles = nodes.value.map((n) => n.data?.title).filter((title): title is string => typeof title === 'string')

    // Check if base title is available (without number)
    if (!existingTitles.includes(baseTitle)) {
      return baseTitle
    }

    // Find the highest number used with this base title
    let maxNumber = 0
    const regex = new RegExp(`^${baseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`)

    existingTitles.forEach((title) => {
      const match = title.match(regex)
      if (match && match[1]) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) {
          maxNumber = num
        }
      }
    })

    // Return the next available number
    return `${baseTitle}${maxNumber + 1}`
  }

  const addPlusNode = async (sourceNodeId: string, edgeLabel?: string) => {
    const plusNode: Node = {
      id: generateUniqueNodeId(nodes.value),
      type: GeneralNodeID.PLUS,
      position: { x: 250, y: 200 },
      data: {
        title: 'Add Action / Condition', // Plus nodes have a fixed title
      },
    }

    // Add edge connecting source to plus node
    const edge: Edge = {
      id: `e:${sourceNodeId}->${plusNode.id}`,
      source: sourceNodeId,
      target: plusNode.id,
      animated: false,
    }

    // Add label for conditional branches
    if (edgeLabel) {
      edge.label = edgeLabel
      edge.labelStyle = { fill: '#6b7280', fontWeight: 600, fontSize: 12 }
      edge.labelBgStyle = { fill: 'white' }
    }

    // Create new arrays with added node and edge
    nodes.value = [...nodes.value, plusNode]
    edges.value = [...edges.value, edge]

    debouncedWorkflowUpdate()

    await triggerLayout()

    return plusNode.id
  }

  const updateNode = async (nodeId: string, updatedData: Partial<Node>) => {
    const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId)
    if (nodeIndex === -1) return

    const existingNode = nodes.value[nodeIndex]
    if (!existingNode) return

    // If the node type is changing, and it's not a core.plus node,
    // generate a unique title for the new node type
    if (updatedData.type && updatedData.type !== existingNode.type && updatedData.type !== GeneralNodeID.PLUS) {
      // Check if we're converting from a plus node or trigger placeholder
      const isConvertingFromPlus = existingNode.type === GeneralNodeID.PLUS
      const isConvertingFromTriggerPlaceholder = existingNode.type === GeneralNodeID.TRIGGER
      const hasPlusNodeTitle = updatedData.data?.title === 'Add Action / Condition'
      const hasTriggerPlaceholderTitle = updatedData.data?.title === 'Trigger'

      // Generate a unique title if:
      // 1. No title is provided, OR
      // 2. Converting from a plus node, OR
      // 3. Converting from trigger placeholder, OR
      // 4. The current title is a default/placeholder title
      if (
        !updatedData.data?.title ||
        isConvertingFromPlus ||
        isConvertingFromTriggerPlaceholder ||
        hasPlusNodeTitle ||
        hasTriggerPlaceholderTitle
      ) {
        const uniqueTitle = generateUniqueNodeTitle(updatedData.type)
        updatedData.data = {
          ...updatedData.data,
          title: uniqueTitle,
        }
      }
    }

    // Create a new array to trigger reactivity properly
    const updatedNodes = [...nodes.value]
    updatedNodes[nodeIndex] = {
      ...existingNode,
      ...updatedData,
    }

    nodes.value = updatedNodes

    debouncedWorkflowUpdate()

    await triggerLayout()
  }

  const deleteNode = async (nodeId: string) => {
    const nodeToDelete = nodes.value.find((n) => n.id === nodeId)
    if (!nodeToDelete) return

    const nodesToDelete = new Set<string>()
    nodesToDelete.add(nodeId)

    // If it's a branch node, find all child nodes recursively
    const nodeTypeMeta = getNodeMetaById(nodeToDelete.type)
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

    const bridgingEdges: Array<Edge> = []

    incomingEdges.forEach((inEdge) => {
      outgoingEdges.forEach((outEdge) => {
        // Only create bridging edge if the target node is NOT being deleted
        // This prevents creating edges to nodes that will be removed
        if (!nodesToDelete.has(outEdge.target)) {
          const newEdge: Edge = {
            id: `e:${inEdge.source}->${outEdge.target}`,
            source: inEdge.source,
            target: outEdge.target,
            animated: true,
          }
          // Only preserve edge label if BOTH incoming and outgoing edges have labels
          // This means we're bridging within a branch context (e.g., deleting a node in the middle of a branch)
          // If only incoming has label (deleting the branch node itself), don't preserve it
          if (inEdge.label && outEdge.label) {
            newEdge.label = inEdge.label
            newEdge.labelStyle = inEdge.labelStyle
            newEdge.labelBgStyle = inEdge.labelBgStyle
          }
          bridgingEdges.push(newEdge)
        }
      })
    })

    nodes.value = nodes.value.filter((n) => !nodesToDelete.has(n.id))

    // Keep edges that aren't connected to deleted nodes, and add bridging edges
    edges.value = [
      ...edges.value.filter((edge) => !nodesToDelete.has(edge.source) && !nodesToDelete.has(edge.target)),
      ...bridgingEdges,
    ]

    debouncedWorkflowUpdate()

    await triggerLayout()

    if (nodes.value?.length === 1 && nodes.value[0]?.type === GeneralNodeID.PLUS) {
      nodes.value = INIT_WORKFLOW_NODES
      edges.value = []
      firstParentNode = null
    }

    await nextTick(() => {
      // Create a new plus node at the position of the first parent node
      if (firstParentNode) {
        addPlusNode(firstParentNode.id)
      }
    })
  }

  const getNodeTypesByCategory = (category: WorkflowNodeCategoryType) => {
    return nodeTypes.value.filter((node) => node.category === category && !node.hidden)
  }

  const executeWorkflow = async () => {
    if (!activeWorkspaceId.value || !activeProjectId.value || !workflow.value) return
    try {
      const executionState = await api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        {
          operation: 'workflowExecute',
        },
        {
          workflowId: workflow.value.id,
          triggerData: {
            timestamp: Date.now(),
          },
        },
      )

      if (executionState.status === 'completed') {
        const duration = ((executionState.endTime - executionState.startTime) / 1000).toFixed(2)
        const nodesCount = executionState?.nodeResults?.length
        message.success(`Workflow executed successfully in ${duration}s (${nodesCount} nodes executed)`)
      } else if (executionState.status === 'error') {
        const errorNode = executionState?.nodeResults?.find((r: any) => r.status === 'error')
        const errorMessage = errorNode ? `Node "${errorNode.nodeTitle}" failed: ${errorNode.error}` : 'Workflow execution failed'
        message.error(errorMessage)
        console.error('[Workflow] Execution error:', executionState)
      }
    } catch (e) {
      message.error('Workflow execution failed')
      console.error('[Workflow] Execution error:', e)
    }
  }

  return {
    // State
    isSidebarOpen,
    workflow,
    nodes,
    edges,
    isSaving,
    nodeTypes: readonly(nodeTypes),
    selectedNodeId,
    selectedNode,
    hasManualTrigger,

    // Methods
    updateWorkflowData,
    debouncedWorkflowUpdate,
    setLayoutCallback,
    triggerLayout,
    updateSelectedNode,
    executeWorkflow,

    // Node utilities
    addPlusNode,
    updateNode,
    deleteNode,
    getNodeTypesByCategory,
    getNodeMetaById,
  }
})

export { useProvideWorkflow }

export function useWorkflowOrThrow() {
  const state = useWorkflow()

  if (!state) {
    throw new Error('useWorkflowOrThrow must be used within a WorkflowStoreProvider')
  }

  return state
}
