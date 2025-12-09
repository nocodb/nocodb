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

interface UIWorkflowNodeDefinition extends WorkflowNodeDefinition {
  input?: number
  output?: number
}

function transformNode(backendNode: WorkflowNodeDefinition): UIWorkflowNodeDefinition {
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
 * Generate a unique node title based on the node type title
 * E.g., 'NocoDB', 'NocoDB1', 'NocoDB2', etc.
 */
const generateUniqueNodeTitle = (nodeMeta: UIWorkflowNodeDefinition, nodes: Node[]): string => {
  const baseTitle = nodeMeta.title

  // Get all existing node titles that start with this base title
  const existingTitles = nodes.map((n) => n.data?.title).filter((title): title is string => typeof title === 'string')

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

const findAllChildNodes = (nodeId: string, edges: Edge[]): Set<string> => {
  const children = new Set<string>()
  const visited = new Set<string>()

  const traverse = (currentId: string) => {
    if (visited.has(currentId)) return
    visited.add(currentId)

    const childEdges = edges.filter((edge) => edge.source === currentId)

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

export {
  generateUniqueNodeId,
  transformNode,
  findAllParentNodes,
  prefixVariableKeysRecursive,
  generateUniqueNodeTitle,
  findAllChildNodes,
}

export type { UIWorkflowNodeDefinition }
