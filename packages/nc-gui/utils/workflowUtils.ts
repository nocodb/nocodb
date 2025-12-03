import type { Edge, Node } from '@vue-flow/core'
import type { WorkflowNodeDefinition } from 'nocodb-sdk'
const generateUniqueNodeId = (nodes: Node[]): string => {
  let candidateId = crypto.randomUUID()

  // Keep incrementing until we find an ID that doesn't exist
  while (nodes.some((n) => n.id === candidateId)) {
    candidateId = crypto.randomUUID()
  }

  return candidateId
}

function transformNode(backendNode: WorkflowNodeDefinition) {
  const inputPorts = backendNode.ports.filter((p: any) => p.direction === 'input')
  const outputPorts = backendNode.ports.filter((p: any) => p.direction === 'output')

  return {
    ...backendNode,
    input: inputPorts.length > 0 ? inputPorts.length : undefined,
    output: outputPorts.length > 0 ? outputPorts.length : undefined,
  }
}

/**
 * Find all parent nodes (upstream nodes) for a given node
 * @param nodeId - The node ID to find parents for
 * @returns Set of parent node IDs in execution order
 */
const findAllParentNodes = (nodeId: string, edges: Edge[]): string[] => {
  const parents: string[] = []
  const visited = new Set<string>()

  const traverse = (currentId: string) => {
    if (visited.has(currentId)) return
    visited.add(currentId)

    // Find edges that point to this node
    const parentEdges = edges.filter((edge) => edge.target === currentId)

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

export { generateUniqueNodeId, transformNode, findAllParentNodes }
