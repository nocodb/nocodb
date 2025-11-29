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

  const { activeBaseNodeSchemas, activeWorkflow } = storeToRefs(workflowStore)

  const { activeProjectId } = storeToRefs(baseStore)

  const { updateWorkflow } = workflowStore

  const selectedNodeId = ref<string | null>(null)

  const activeTab = ref<'editor' | 'runs'>('editor')

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
    { description, nodes, edges, title }: { description?: string; nodes?: Array<Node>; edges?: Array<Edge>; title?: string },
    skipNetworkCall: boolean = true,
  ) => {
    if (!activeProjectId.value || !workflow.value?.id) return

    console.log('updateWorkflowData', { description, nodes, edges, title })

    if (isUIAllowed('workflowCreateOrEdit')) {
      isSaving.value = true
      try {
        await updateWorkflow(
          activeProjectId.value,
          workflow.value.id,
          {
            ...(title ? { title } : {}),
            ...(description ? { description } : {}),
            ...(nodes ? { nodes } : {}),
            ...(edges ? { edges } : {}),
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
        description: activeWorkflow.value?.description,
        nodes: nodes.value,
        edges: edges.value,
        title: activeWorkflow.value?.title,
      },
      false,
    )
  }, 500)

  const updateSelectedNode = (nodeId: string) => {
    selectedNodeId.value = nodeId
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

  const findAllChildNodes = (nodeId: string): Set<string> => {
    const children = new Set<string>()
    const visited = new Set<string>()

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return
      visited.add(currentId)

      const childEdges = edges.value.filter((edge) => edge.source === currentId)

      for (const edge of childEdges) {
        if (edge.target) {
          children.add(edge.target)
          traverse(edge.target)
        }
      }
    }

    traverse(nodeId)
    return children
  }

  const clearChildNodesTestResults = (nodeId: string) => {
    const childNodeIds = findAllChildNodes(nodeId)
    if (childNodeIds.size === 0) return

    const updatedNodes = nodes.value.map((node) => {
      if (childNodeIds.has(node.id) && node.data?.testResult) {
        const { testResult: _testResult, ...dataWithoutTestResult } = node.data
        return {
          ...node,
          data: dataWithoutTestResult,
        }
      }
      return node
    })

    nodes.value = updatedNodes
    debouncedWorkflowUpdate()
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

  const fetchNodeIntegrationOptions = async (formState: any, key: string) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return
    try {
      return await api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        {
          operation: 'workflowNodeIntegrationFetchOptions',
        },
        {
          integration: formState,
          key,
        },
      )
    } catch (e) {
      message.error('Failed to fetch node integration options')
      console.error('[Workflow] Fetch node integration options error:', e)
      return []
    }
  }

  const testExecuteNode = async (nodeId: string, testTriggerData?: any) => {
    if (!activeWorkspaceId.value || !activeProjectId.value || !workflow.value) return

    try {
      const result = await api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        {
          operation: 'workflowTestNode',
        },
        {
          workflowId: workflow.value.id,
          nodeId,
          testTriggerData,
        },
      )

      // Store test result in the node's data
      const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId)
      if (nodeIndex !== -1) {
        const updatedNodes = [...nodes.value]
        updatedNodes[nodeIndex] = {
          ...updatedNodes[nodeIndex],
          data: {
            ...updatedNodes[nodeIndex].data,
            testResult: result,
          },
        }
        nodes.value = updatedNodes

        // Save to backend
        debouncedWorkflowUpdate()
      }

      message.success(`Test executed successfully for "${result.nodeTitle}"`)

      return result
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      console.error('[Workflow] Test execution error:', e)
    }
  }

  /**
   * Find all parent nodes (upstream nodes) for a given node
   * @param nodeId - The node ID to find parents for
   * @returns Set of parent node IDs in execution order
   */
  const findAllParentNodes = (nodeId: string): string[] => {
    const parents: string[] = []
    const visited = new Set<string>()

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return
      visited.add(currentId)

      // Find edges that point to this node
      const parentEdges = edges.value.filter((edge) => edge.target === currentId)

      for (const edge of parentEdges) {
        if (edge.source && edge.source !== currentId) {
          // First traverse to parents of this parent (to maintain execution order)
          traverse(edge.source)
          // Then add this parent
          if (!parents.includes(edge.source)) {
            parents.push(edge.source)
          }
        }
      }
    }

    traverse(nodeId)
    return parents
  }

  /**
   * Recursively prefix all variable keys (including children) with the node reference
   */
  const prefixVariableKeysRecursive = (variable: any, prefix: string): any => {
    return {
      ...variable,
      key: `${prefix}.${variable.key}`,
      children: variable.children?.map((child: any) => prefixVariableKeysRecursive(child, prefix)),
    }
  }

  /**
   * Get available variables from all upstream nodes for a given node
   * These are the output variables from nodes that have been tested and come before this node
   * @param nodeId - The node ID to get available variables for
   * @returns Array of variable definitions with node context
   */
  const getAvailableVariables = (nodeId: string) => {
    const parentNodeIds = findAllParentNodes(nodeId)
    const variables: Array<{
      nodeId: string
      nodeTitle: string
      nodeIcon?: string
      variables: any[]
    }> = []

    for (const parentId of parentNodeIds) {
      const parentNode = nodes.value.find((n) => n.id === parentId)
      if (!parentNode) continue

      // Skip nodes without test results or output variables
      const testResult = parentNode.data?.testResult
      if (!testResult?.outputVariables || testResult.outputVariables.length === 0) continue

      // Get node definition to access the icon
      const nodeMeta = getNodeMetaById(parentNode.type)
      const nodeIcon = nodeMeta?.icon

      const nodePrefix = `$('${parentNode.data?.title || parentId}')`

      // Add the node's variables with node context, recursively prefixing all keys
      variables.push({
        nodeId: parentId,
        nodeTitle: parentNode.data?.title || parentId,
        nodeIcon,
        variables: testResult.outputVariables.map((v: any) => ({
          ...prefixVariableKeysRecursive(v, nodePrefix),
          extra: {
            ...v.extra,
            sourceNodeId: parentId,
            sourceNodeTitle: parentNode.data?.title || parentId,
            nodeIcon,
          },
        })),
      })
    }

    return variables
  }

  /**
   * Get a flat list of all available variables for a node
   * @param nodeId - The node ID to get available variables for
   * @returns Flat array of variable definitions
   */
  const getAvailableVariablesFlat = (nodeId: string) => {
    const groupedVariables = getAvailableVariables(nodeId)
    return groupedVariables.flatMap((group) => group.variables)
  }

  return {
    // State
    workflow,
    nodes,
    edges,
    isSaving,
    nodeTypes: readonly(nodeTypes),
    selectedNodeId,
    selectedNode,
    hasManualTrigger,
    activeTab,

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
    fetchNodeIntegrationOptions,
    testExecuteNode,
    clearChildNodesTestResults,
    getAvailableVariables,
    getAvailableVariablesFlat,
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
