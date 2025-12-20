import type { IWorkflowExecution, WorkflowGeneralNode, WorkflowType } from 'nocodb-sdk'
import { GENERAL_DEFAULT_NODES, GeneralNodeID, INIT_WORKFLOW_NODES } from 'nocodb-sdk'
import type { Edge, Node } from '@vue-flow/core'
import rfdc from 'rfdc'
import {
  cleanupPortsOnTypeChange,
  ensurePortsConnected,
  filterOutPlusNodes,
  findParentNodesNeedingPlusNodes,
} from '~/utils/workflowGraphUtils'

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

  const selectedNode = computed<WorkflowGeneralNode | null>((): WorkflowGeneralNode | null => {
    if (!selectedNodeId.value) return null

    const node = nodes.value.find((n) => n.id === selectedNodeId.value)

    if (node && node.type) {
      return node as WorkflowGeneralNode
    }

    return null
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

  const addPlusNode = async (sourceNodeId: string, edgeLabel?: string, sourcePortId?: string, skipLayout = false) => {
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

    if (sourcePortId) {
      edge.sourceHandle = sourcePortId
      edge.sourcePortId = sourcePortId
    }

    nodes.value = [...nodes.value, plusNode]
    edges.value = [...edges.value, edge]

    debouncedWorkflowUpdate()

    if (!skipLayout) {
      await triggerLayout()
    }

    return plusNode.id
  }

  const addNode = async (node: Node) => {
    nodes.value = [...nodes.value, node]
    debouncedWorkflowUpdate()
  }

  const updateNode = async (nodeId: string, updatedData: Partial<Node>) => {
    const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId)
    if (nodeIndex === -1) return

    const existingNode = nodes.value[nodeIndex]
    if (!existingNode) return

    // For note nodes, just update the data and skip workflow-specific logic
    if (existingNode.type === GeneralNodeID.NOTE) {
      const updatedNodes = [...nodes.value]
      const currentNodeIndex = updatedNodes.findIndex((n) => n.id === nodeId)
      if (currentNodeIndex !== -1 && updatedNodes[currentNodeIndex]) {
        updatedNodes[currentNodeIndex] = {
          ...updatedNodes[currentNodeIndex],
          ...updatedData,
        }
      }
      nodes.value = updatedNodes
      debouncedWorkflowUpdate()
      return
    }

    const oldTitle = existingNode.data?.title
    const newTitle = updatedData.data?.title
    const isTitleChanged = newTitle && oldTitle && newTitle !== oldTitle

    const isTypeChanged = updatedData.type && updatedData.type !== existingNode.type && updatedData.type !== GeneralNodeID.PLUS

    const updatedNodes = [...nodes.value]
    const currentNodeIndex = updatedNodes.findIndex((n) => n.id === nodeId)
    if (currentNodeIndex !== -1 && updatedNodes[currentNodeIndex]) {
      updatedNodes[currentNodeIndex] = {
        ...updatedNodes[currentNodeIndex],
        ...updatedData,
      }
    }

    if (isTitleChanged) {
      const childNodeIds = findAllChildNodes(nodeId, edges.value)

      for (const childNodeId of childNodeIds) {
        const childNodeIndex = updatedNodes.findIndex((n) => n.id === childNodeId)
        if (childNodeIndex !== -1) {
          const childNode = updatedNodes[childNodeIndex]
          if (childNode?.data) {
            const updatedChildData = updateVariableReferencesInObject(childNode.data, oldTitle, newTitle)

            updatedNodes[childNodeIndex] = {
              ...childNode,
              data: updatedChildData,
            }
          }
        }
      }
    }

    nodes.value = updatedNodes

    if (isTypeChanged) {
      const nodeMeta = getNodeMetaById(updatedData.type)
      if (!nodeMeta) return
      const uniqueTitle = generateUniqueNodeTitle(nodeMeta, nodes.value)

      // Update the node with unique title
      const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId)
      if (nodeIndex !== -1 && nodes.value[nodeIndex]) {
        nodes.value[nodeIndex] = {
          ...nodes.value[nodeIndex],
          data: {
            ...nodes.value[nodeIndex].data,
            title: uniqueTitle,
          },
        }
      }

      // Clear all testResult of sub nodes if type is changed
      clearChildNodesTestResults(nodeId)

      const oldNodeMeta = getNodeMetaById(existingNode.type)
      const cleanupResult = cleanupPortsOnTypeChange(nodeId, oldNodeMeta, nodeMeta, nodes.value, edges.value, findAllChildNodes)

      nodes.value = cleanupResult.nodes
      edges.value = cleanupResult.edges
    }

    debouncedWorkflowUpdate()

    if (isTypeChanged) {
      const nodeMeta = getNodeMetaById(updatedData.type)
      await ensurePortsConnected(nodeId, nodeMeta, edges.value, addPlusNode, false)
    }

    // Trigger layout once after all changes are complete
    await triggerLayout()
  }

  const deleteNode = async (nodeId: string) => {
    const nodeToDelete = nodes.value.find((n) => n.id === nodeId)
    if (!nodeToDelete) return

    // For note nodes, just remove from array and skip workflow-specific logic
    if (nodeToDelete.type === GeneralNodeID.NOTE) {
      nodes.value = nodes.value.filter((n) => n.id !== nodeId)
      debouncedWorkflowUpdate()
      return
    }

    const nodesToDelete = new Set<string>()

    nodesToDelete.add(nodeId)

    const nodeTypeMeta = getNodeMetaById(nodeToDelete.type)

    let firstParentNode: Node | null = null

    clearChildNodesTestResults(nodeId)

    if (nodeTypeMeta && nodeTypeMeta.output && nodeTypeMeta.output > 1) {
      const childNodeIds = findAllChildNodes(nodeId, edges.value)
      childNodeIds.forEach((id) => nodesToDelete.add(id))

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
          if (inEdge.sourceHandle) {
            newEdge.sourceHandle = inEdge.sourceHandle // Vue Flow uses sourceHandle
            newEdge.sourcePortId = inEdge.sourceHandle // Backend uses sourcePortId
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

    const parentNodesNeedingPlusNodes = findParentNodesNeedingPlusNodes(
      nodesToDelete,
      incomingEdges,
      outgoingEdges,
      nodes.value,
      getNodeMetaById,
    )

    debouncedWorkflowUpdate()

    if (nodes.value?.length === 1 && nodes.value[0]?.type === GeneralNodeID.PLUS) {
      nodes.value = INIT_WORKFLOW_NODES
      edges.value = []
      firstParentNode = null
    }

    await nextTick()
    if (firstParentNode) {
      await addPlusNode(firstParentNode.id, undefined, undefined, true)
    }

    for (const [parentNodeId, emptyPorts] of parentNodesNeedingPlusNodes) {
      for (const port of emptyPorts) {
        await addPlusNode(parentNodeId, port.label, port.id, true)
      }
    }

    await triggerLayout()
  }

  function clearChildNodesTestResults(nodeId: string) {
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

  const updateNodeTestResult = (nodeId: string, testResult: any) => {
    const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId)
    if (nodeIndex !== -1) {
      const updatedNodes = [...nodes.value]
      if (updatedNodes[nodeIndex]?.data) {
        updatedNodes[nodeIndex] = {
          ...updatedNodes[nodeIndex],
          data: {
            ...updatedNodes[nodeIndex].data,
            testResult,
          },
        }
      }
      nodes.value = updatedNodes
      debouncedWorkflowUpdate()
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

      updateNodeTestResult(nodeId, result)
      return result
    } catch (e: any) {
      updateNodeTestResult(nodeId, {
        status: 'error',
        error: await extractSdkResponseErrorMsgv2(e),
      })
      console.error('[Workflow] Test execution error:', e)
      throw e
    }
  }

  watch(viewingExecution, async (execution) => {
    if (execution) {
      if (execution.workflow_data) {
        const filtered = filterOutPlusNodes(execution.workflow_data.nodes || [], execution.workflow_data.edges || [])
        nodes.value = filtered.nodes as Array<Node>
        edges.value = filtered.edges as Array<Edge>
        await triggerLayout()
      }
    } else {
      const sourceNodes = workflow.value?.draft?.nodes || workflow.value?.nodes || INIT_WORKFLOW_NODES
      const sourceEdges = workflow.value?.draft?.edges || workflow.value?.edges || []

      if (activeTab.value === 'logs') {
        const filtered = filterOutPlusNodes(sourceNodes as Array<Node>, sourceEdges as Array<Edge>)
        nodes.value = filtered.nodes
        edges.value = filtered.edges
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
        const filtered = filterOutPlusNodes(sourceNodes as Array<Node>, sourceEdges as Array<Edge>)
        nodes.value = filtered.nodes
        edges.value = filtered.edges
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
        const filtered = filterOutPlusNodes(updatedNodes as Array<Node>, updatedEdges as Array<Edge>)
        nodes.value = filtered.nodes
        edges.value = filtered.edges
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
    addNode,
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
