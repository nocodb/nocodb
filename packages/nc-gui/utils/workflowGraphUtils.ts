import type { Edge, Node } from '@vue-flow/core'
import type { WorkflowNodeDefinition } from 'nocodb-sdk'
import { GeneralNodeID } from 'nocodb-sdk'

/**
 * Filter out plus nodes and their associated edges
 * Used when viewing execution logs or workflow history
 */
export function filterOutPlusNodes(sourceNodes: Array<Node>, sourceEdges: Array<Edge>) {
  const filteredNodes = sourceNodes.filter((node: Node) => ![GeneralNodeID.PLUS].includes(node.type as any))

  const removedNodeIds = new Set(
    sourceNodes.filter((node: Node) => Object.values(GeneralNodeID).includes(node.type as any)).map((node: Node) => node.id),
  )

  const filteredEdges = sourceEdges.filter((edge: Edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target))

  return { nodes: filteredNodes, edges: filteredEdges }
}

/**
 * Get all output ports for a node
 */
export function getNodeOutputPorts(
  nodeMeta: (WorkflowNodeDefinition & { output?: number }) | null,
): Array<{ id: string; label?: string; order?: number }> {
  if (!nodeMeta) return []

  // Skip Plus nodes - they are placeholders with no outputs
  if (nodeMeta.id === GeneralNodeID.PLUS) {
    return []
  }

  // First check ports array
  const ports = nodeMeta.ports?.filter((p) => p.direction === 'output').sort((a, b) => (a.order || 0) - (b.order || 0)) || []

  if (ports.length > 0) {
    return ports
  }

  return []
}

/**
 * Check if a node has any output ports
 */
export function hasOutputPorts(nodeMeta: WorkflowNodeDefinition | null): boolean {
  return getNodeOutputPorts(nodeMeta).length > 0
}

/**
 * Get all edges from a specific node
 */
export function getNodeOutgoingEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter((e) => e.source === nodeId)
}

/**
 * Get edges from a specific output port of a node
 */
export function getPortOutgoingEdges(nodeId: string, portId: string, edges: Edge[]): Edge[] {
  return edges.filter((e) => e.source === nodeId && e.sourceHandle === portId)
}

/**
 * Find which output ports have no outgoing edges (empty ports)
 */
export function findEmptyOutputPorts(
  nodeId: string,
  nodeMeta: (WorkflowNodeDefinition & { output?: number }) | null,
  edges: Edge[],
): Array<{ id: string; label?: string }> {
  const outputPorts = getNodeOutputPorts(nodeMeta)
  if (outputPorts.length === 0) return []

  const emptyPorts: Array<{ id: string; label?: string }> = []

  // For single output nodes, check if there are ANY outgoing edges (sourceHandle might be undefined)
  const isSingleOutput = outputPorts.length === 1
  const allOutgoingEdges = getNodeOutgoingEdges(nodeId, edges)

  for (const port of outputPorts) {
    let hasEdge = false

    if (isSingleOutput) {
      // For single output, any outgoing edge counts (sourceHandle may be undefined)
      hasEdge = allOutgoingEdges.length > 0
    } else {
      // For multi-output, check specific port
      const portEdges = getPortOutgoingEdges(nodeId, port.id, edges)
      hasEdge = portEdges.length > 0
    }

    if (!hasEdge) {
      emptyPorts.push({ id: port.id, label: port.label })
    }
  }

  return emptyPorts
}

/**
 * Check if a node should have plus nodes added
 * A node needs plus nodes if it has output ports with no connections
 */
export function shouldAddPlusNodes(nodeId: string, nodeMeta: WorkflowNodeDefinition | null, edges: Edge[]): boolean {
  if (!nodeMeta) return false

  const outputPorts = getNodeOutputPorts(nodeMeta)
  if (outputPorts.length === 0) return false

  // Check if any output port is empty
  return findEmptyOutputPorts(nodeId, nodeMeta, edges).length > 0
}

/**
 * Ensure all output ports of a node have connections (add plus nodes if needed)
 * @param skipLayout - If true, skips layout trigger for each plus node (caller should trigger layout after)
 */
export async function ensurePortsConnected(
  nodeId: string,
  nodeMeta: WorkflowNodeDefinition | null,
  edges: Edge[],
  addPlusNodeFn: (sourceNodeId: string, edgeLabel?: string, sourcePortId?: string, skipLayout?: boolean) => Promise<string>,
  skipLayout = false,
): Promise<void> {
  if (!nodeMeta) return

  const emptyPorts = findEmptyOutputPorts(nodeId, nodeMeta, edges)

  // Add plus nodes sequentially
  for (const port of emptyPorts) {
    await addPlusNodeFn(nodeId, port.label, port.id, skipLayout)
  }
}

/**
 * Clean up ports when a node type changes
 * Only removes child nodes when the port structure actually changes
 */
export function cleanupPortsOnTypeChange(
  nodeId: string,
  oldNodeMeta: WorkflowNodeDefinition | null,
  newNodeMeta: WorkflowNodeDefinition | null,
  nodes: Node[],
  edges: Edge[],
  findAllChildNodesFn: (nodeId: string, edges: Edge[]) => Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  // Get all outgoing edges from this node
  const outgoingEdges = getNodeOutgoingEdges(nodeId, edges)

  if (outgoingEdges.length === 0) {
    return { nodes, edges }
  }

  // Check if port structure actually changed
  const oldPorts = getNodeOutputPorts(oldNodeMeta)
  const newPorts = getNodeOutputPorts(newNodeMeta)

  // If same number of ports and same port IDs, preserve child nodes
  if (oldPorts.length === newPorts.length && oldPorts.length > 0) {
    const oldPortIds = new Set(oldPorts.map((p) => p.id))
    const newPortIds = new Set(newPorts.map((p) => p.id))
    const sameStructure = [...oldPortIds].every((id) => newPortIds.has(id))

    if (sameStructure) {
      return { nodes, edges }
    }
  }

  // Port structure changed, remove all child nodes
  const nodesToDelete = new Set<string>()

  for (const edge of outgoingEdges) {
    nodesToDelete.add(edge.target)
    const childNodeIds = findAllChildNodesFn(edge.target, edges)
    childNodeIds.forEach((id) => nodesToDelete.add(id))
  }

  // Filter out deleted nodes and their edges
  const filteredNodes = nodes.filter((n) => !nodesToDelete.has(n.id))
  const filteredEdges = edges.filter((edge) => !nodesToDelete.has(edge.source) && !nodesToDelete.has(edge.target))

  return { nodes: filteredNodes, edges: filteredEdges }
}

/**
 * Handle node deletion and restore empty ports
 * Returns a map of parent nodes to their empty ports that need plus nodes
 */
export function findParentNodesNeedingPlusNodes(
  deletedNodeIds: Set<string>,
  incomingEdges: Edge[],
  outgoingEdges: Edge[],
  nodes: Node[],
  getNodeMetaByIdFn: (id?: string) => WorkflowNodeDefinition | null,
  allEdges: Edge[],
): Map<string, Array<{ id: string; label?: string }>> {
  const parentNodesWithEmptyPorts = new Map<string, Array<{ id: string; label?: string }>>()

  incomingEdges.forEach((inEdge) => {
    const parentNode = nodes.find((n) => n.id === inEdge.source)
    if (!parentNode) return

    const parentNodeMeta = getNodeMetaByIdFn(parentNode.type)
    const outputPorts = getNodeOutputPorts(parentNodeMeta)

    // Only process multi-port nodes
    if (outputPorts.length <= 1) return

    // Check if the parent node's specific port still has any remaining connections
    // after this deletion (excluding edges to deleted nodes)
    const portStillHasConnection = allEdges.some(
      (edge) => edge.source === inEdge.source && edge.sourceHandle === inEdge.sourceHandle && !deletedNodeIds.has(edge.target),
    )

    if (!portStillHasConnection && inEdge.sourceHandle) {
      const port = outputPorts.find((p) => p.id === inEdge.sourceHandle)
      if (port) {
        if (!parentNodesWithEmptyPorts.has(inEdge.source)) {
          parentNodesWithEmptyPorts.set(inEdge.source, [])
        }
        const existingPorts = parentNodesWithEmptyPorts.get(inEdge.source)!
        // Only add if not already in the list (avoid duplicates)
        if (!existingPorts.some((p) => p.id === port.id)) {
          existingPorts.push({ id: port.id, label: port.label })
        }
      }
    }
  })

  return parentNodesWithEmptyPorts
}
