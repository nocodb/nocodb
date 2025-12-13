import type { IWorkflowExecution, WorkflowGeneralNode, WorkflowType } from 'nocodb-sdk'
import { GENERAL_DEFAULT_NODES, GeneralNodeID, INIT_WORKFLOW_NODES } from 'nocodb-sdk'
import type { Edge, Node } from '@vue-flow/core'
import rfdc from 'rfdc'

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

  const activeTab = ref<'editor' | 'logs'>('editor')

  const isSaving = ref(false)

  const viewingExecution = ref<IWorkflowExecution | null>(null)

  const nodes = ref<Array<Node>>((workflow.value?.draft?.nodes || workflow.value?.nodes || INIT_WORKFLOW_NODES) as Array<Node>)

  const edges = ref<Array<Edge>>((workflow.value?.draft?.edges || workflow.value?.edges || []) as Array<Edge>)

  const nodeTypes = computed<Array<UIWorkflowNodeDefinition>>(() => {
    return [...GENERAL_DEFAULT_NODES, ...activeBaseNodeSchemas.value.map(transformNode)]
  })

  const selectedNode = computed<null | WorkflowGeneralNode>(() => {
    if (!selectedNodeId.value) return null
    return nodes.value.find((n) => n.id === selectedNodeId.value) as WorkflowGeneralNode
  })

  const getNodeMetaById = (id?: string): UIWorkflowNodeDefinition | null => {
    const node = nodeTypes.value.find((node) => node.id === id)
    return node ? (clone(node) as UIWorkflowNodeDefinition) : null
  }

  const updateWorkflowData = async (
    { description, nodes, edges, title }: { description?: string; nodes?: Array<Node>; edges?: Array<Edge>; title?: string },
    skipNetworkCall: boolean = true,
  ) => {
    if (!activeProjectId.value || !workflow.value?.id) return
    if (isUIAllowed('workflowCreateOrEdit')) {
      isSaving.value = true
      try {
        const updatePayload: any = {
          ...(title ? { title } : {}),
          ...(description ? { description } : {}),
        }

        // If nodes or edges are being updated, wrap them in draft
        if (nodes || edges) {
          updatePayload.draft = {
            nodes: nodes || workflow.value.draft?.nodes || workflow.value.nodes,
            edges: edges || workflow.value.draft?.edges || workflow.value.edges,
          }
        }

        await updateWorkflow(activeProjectId.value, workflow.value.id, updatePayload, {
          skipNetworkCall,
        })
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

  // Callback for layout - will be set by Main.vue
  let layoutCallback: (() => Promise<void>) | null = null

  const setLayoutCallback = (callback: () => Promise<void>) => {
    layoutCallback = callback
  }

  const triggerLayout = async () => {
    await nextTick()
    layoutCallback?.()
  }

  const addPlusNode = async (sourceNodeId: string, edgeLabel?: string) => {
    const plusNode: Node = {
      id: generateUniqueNodeId(nodes.value),
      type: GeneralNodeID.PLUS,
      position: { x: 250, y: 200 },
      data: {
        title: 'Add Action / Condition',
      },
    }

    const edge: Edge = {
      id: `e:${sourceNodeId}->${plusNode.id}`,
      source: sourceNodeId,
      target: plusNode.id,
      animated: false,
      type: 'smoothstep',
    }

    if (edgeLabel) {
      edge.label = edgeLabel
      edge.labelStyle = { fill: '#6b7280', fontWeight: 600, fontSize: 12 }
      edge.labelBgStyle = { fill: 'white' }
    }

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

    if (updatedData.type && updatedData.type !== existingNode.type && updatedData.type !== GeneralNodeID.PLUS) {
      const nodeMeta = getNodeMetaById(updatedData.type)
      if (!nodeMeta) return
      const uniqueTitle = generateUniqueNodeTitle(nodeMeta, nodes.value)
      updatedData.data = {
        ...updatedData.data,
        title: uniqueTitle,
      }
    }

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

    const incomingEdges = edges.value.filter((e) => nodesToDelete.has(e.target))
    const outgoingEdges = edges.value.filter((e) => nodesToDelete.has(e.source))

    const bridgingEdges: Array<Edge> = []

    incomingEdges.forEach((inEdge) => {
      outgoingEdges.forEach((outEdge) => {
        if (!nodesToDelete.has(outEdge.target)) {
          const newEdge: Edge = {
            id: `e:${inEdge.source}->${outEdge.target}`,
            source: inEdge.source,
            target: outEdge.target,
            animated: false, // Never animate edges
            type: 'smoothstep',
          }
          if (inEdge.label) {
            newEdge.label = inEdge.label
            newEdge.labelStyle = inEdge.labelStyle
            newEdge.labelBgStyle = inEdge.labelBgStyle
          }
          bridgingEdges.push(newEdge)
        }
      })
    })

    nodes.value = nodes.value.filter((n) => !nodesToDelete.has(n.id))

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
      if (firstParentNode) {
        addPlusNode(firstParentNode.id)
      }
    })
  }

  const clearChildNodesTestResults = async (nodeId: string) => {
    const childNodeIds = findAllChildNodes(nodeId, edges.value)
    if (childNodeIds.size === 0) return

    nodes.value = nodes.value.map((node) => {
      if (childNodeIds.has(node.id) && node.data?.testResult) {
        const { testResult: _testResult, ...dataWithoutTestResult } = node.data
        return {
          ...node,
          data: dataWithoutTestResult,
        }
      }
      return node
    })
    debouncedWorkflowUpdate()
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
        if (updatedNodes && updatedNodes[nodeIndex] && updatedNodes[nodeIndex].data) {
          updatedNodes[nodeIndex] = {
            ...updatedNodes[nodeIndex],
            data: {
              ...updatedNodes[nodeIndex].data,
              testResult: result,
            },
          }
        }
        nodes.value = updatedNodes

        // Save to backend
        debouncedWorkflowUpdate()
      }
      return result
    } catch (e: any) {
      // Clear the Local test Result
      const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId)
      if (nodeIndex !== -1) {
        const updatedNodes = [...nodes.value]
        if (updatedNodes && updatedNodes[nodeIndex] && updatedNodes[nodeIndex].data) {
          updatedNodes[nodeIndex] = {
            ...updatedNodes[nodeIndex],
            data: {
              ...updatedNodes[nodeIndex].data,
              testResult: {
                status: 'error',
                error: await extractSdkResponseErrorMsgv2(e),
              },
            },
          }
        }
        nodes.value = updatedNodes

        // Save to backend
        debouncedWorkflowUpdate()
      }
      console.error('[Workflow] Test execution error:', e)
      throw e
    }
  }

  watch(viewingExecution, async (execution) => {
    if (execution) {
      if (execution.workflow_data) {
        nodes.value = (execution.workflow_data.nodes || []).filter(
          (node: Node) => !Object.values(GeneralNodeID).includes(node.type as any),
        ) as Array<Node>

        const removedNodeIds = new Set(
          (execution.workflow_data.nodes || [])
            .filter((node: Node) => Object.values(GeneralNodeID).includes(node.type as any))
            .map((node: Node) => node.id),
        )

        edges.value = (execution.workflow_data.edges || []).filter(
          (edge: Edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target),
        ) as Array<Edge>
        await triggerLayout()
      }
    } else {
      const sourceNodes = workflow.value?.draft?.nodes || workflow.value?.nodes || INIT_WORKFLOW_NODES
      const sourceEdges = workflow.value?.draft?.edges || workflow.value?.edges || []

      if (activeTab.value === 'logs') {
        nodes.value = (sourceNodes as Array<Node>).filter(
          (node: Node) => !Object.values(GeneralNodeID).includes(node.type as any),
        )

        const removedNodeIds = new Set(
          (sourceNodes as Array<Node>)
            .filter((node: Node) => Object.values(GeneralNodeID).includes(node.type as any))
            .map((node: Node) => node.id),
        )

        edges.value = (sourceEdges as Array<Edge>).filter(
          (edge: Edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target),
        )
      } else {
        nodes.value = sourceNodes as Array<Node>
        edges.value = sourceEdges as Array<Edge>
      }
      await triggerLayout()
    }
  })

  watch(activeTab, async (tab) => {
    if (tab === 'editor' && viewingExecution.value) {
      viewingExecution.value = null
      selectedNodeId.value = null
    }

    if (!viewingExecution.value) {
      const sourceNodes = workflow.value?.draft?.nodes || workflow.value?.nodes || INIT_WORKFLOW_NODES
      const sourceEdges = workflow.value?.draft?.edges || workflow.value?.edges || []

      if (tab === 'logs') {
        nodes.value = (sourceNodes as Array<Node>).filter(
          (node: Node) => !Object.values(GeneralNodeID).includes(node.type as any),
        )

        const removedNodeIds = new Set(
          (sourceNodes as Array<Node>)
            .filter((node: Node) => Object.values(GeneralNodeID).includes(node.type as any))
            .map((node: Node) => node.id),
        )

        edges.value = (sourceEdges as Array<Edge>).filter(
          (edge: Edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target),
        )
      } else {
        nodes.value = sourceNodes as Array<Node>
        edges.value = sourceEdges as Array<Edge>
      }
      await triggerLayout()
    }
  })

  watch(
    () => (workflow.value as any)?._dirty,
    async (newVal) => {
      if (!newVal) return

      const updatedNodes = workflow.value?.draft?.nodes || workflow.value?.nodes || INIT_WORKFLOW_NODES
      const updatedEdges = workflow.value?.draft?.edges || workflow.value?.edges || []

      if (activeTab.value === 'logs') {
        nodes.value = (updatedNodes as Array<Node>).filter(
          (node: Node) => !Object.values(GeneralNodeID).includes(node.type as any),
        )

        const removedNodeIds = new Set(
          (updatedNodes as Array<Node>)
            .filter((node: Node) => Object.values(GeneralNodeID).includes(node.type as any))
            .map((node: Node) => node.id),
        )

        edges.value = (updatedEdges as Array<Edge>).filter(
          (edge: Edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target),
        )
      } else {
        nodes.value = updatedNodes as Array<Node>
        edges.value = updatedEdges as Array<Edge>
      }

      await triggerLayout()
    },
  )

  return {
    // State
    workflow,
    nodes,
    edges,
    isSaving,
    nodeTypes: readonly(nodeTypes),
    selectedNodeId,
    selectedNode,
    activeTab,
    viewingExecution,

    // Methods
    updateWorkflowData,
    debouncedWorkflowUpdate,
    setLayoutCallback,
    triggerLayout,

    // Node utilities
    addPlusNode,
    updateNode,
    deleteNode,
    getNodeMetaById,
    fetchNodeIntegrationOptions,
    testExecuteNode,
    clearChildNodesTestResults,
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
