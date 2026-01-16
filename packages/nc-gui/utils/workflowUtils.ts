import type { Edge, Node } from '@vue-flow/core'
import type { WorkflowNodeDefinition, WorkflowType } from 'nocodb-sdk'
import { GeneralNodeID, INIT_WORKFLOW_NODES } from 'nocodb-sdk'
import { generateRandomUUID } from '~/utils/generateName'

/**
 * Filter nodes and edges based on edit permission
 * Removes Plus and Trigger nodes when user doesn't have edit permission
 */
const filterNodesByPermission = (nodes: Array<Node>, edges: Array<Edge>, hasEditPermission: boolean) => {
  if (hasEditPermission) {
    return { nodes, edges }
  }

  // Filter out Plus and Trigger nodes when user doesn't have edit permission
  const filteredNodes = nodes.filter((node) => node.type !== GeneralNodeID.PLUS && node.type !== GeneralNodeID.TRIGGER)

  // Get IDs of filtered out nodes
  const filteredNodeIds = new Set(
    nodes.filter((node) => node.type === GeneralNodeID.PLUS || node.type === GeneralNodeID.TRIGGER).map((n) => n.id),
  )

  // Filter out edges connected to filtered nodes
  const filteredEdges = edges.filter((edge) => !filteredNodeIds.has(edge.source) && !filteredNodeIds.has(edge.target))

  return { nodes: filteredNodes, edges: filteredEdges }
}

/**
 * Get source nodes/edges based on permission
 * Don't use draft if user doesn't have edit permission
 */
const getSourceNodesAndEdges = (workflow: WorkflowType, hasEditPermission: boolean) => {
  const sourceNodes = hasEditPermission
    ? workflow?.draft?.nodes || workflow?.nodes || INIT_WORKFLOW_NODES
    : workflow?.nodes || INIT_WORKFLOW_NODES

  const sourceEdges = hasEditPermission ? workflow?.draft?.edges || workflow?.edges || [] : workflow?.edges || []

  return { sourceNodes: sourceNodes as Array<Node>, sourceEdges: sourceEdges as Array<Edge> }
}

const generateUniqueNodeId = (nodes: Node[]): string => {
  let candidateId = generateRandomUUID()

  // Keep incrementing until we find an ID that doesn't exist
  while (nodes.some((n) => n.id === candidateId)) {
    candidateId = generateRandomUUID()
  }

  return candidateId
}

/**
 * Generate a unique trigger ID for webhook triggers
 * Format: trg_{8 alphanumeric characters}
 */
const generateTriggerId = (): string => {
  const uuid = generateRandomUUID()
  // Use first 8 characters of UUID (removing hyphens)
  const shortId = uuid.replace(/-/g, '').substring(0, 8)
  return `trg_${shortId}`
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
 * @param edges - All edges in the workflow
 * @returns array of parent node IDs in execution order
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

/**
 * Find which output port from an iterate node leads to a target node
 * Recursively follows edges to determine the port path
 * @param iterateNodeId - The iterate node ID
 * @param targetNodeId - The target node ID we're trying to reach
 * @param edges - All edges in the workflow
 * @returns The port ID ('body' or 'output') or null if no path found
 */
const findIterateNodePortForPath = (iterateNodeId: string, targetNodeId: string, edges: Edge[]): string | null => {
  // Find all edges from the iterate node
  const iterateEdges = edges.filter((e) => e.source === iterateNodeId)

  // For each output port from the iterate node
  for (const edge of iterateEdges) {
    const portId = edge.sourceHandle

    // Check if this edge leads to the target node (directly or indirectly)
    const visited = new Set<string>()
    const queue = [edge.target]

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!

      if (currentNodeId === targetNodeId) {
        // Found a path from this port to the target node
        return portId as string
      }

      if (visited.has(currentNodeId)) continue
      visited.add(currentNodeId)

      // Add all child nodes to the queue
      const childEdges = edges.filter((e) => e.source === currentNodeId)
      for (const childEdge of childEdges) {
        queue.push(childEdge.target)
      }
    }
  }

  return null
}

/**
 * Update variable references in a string when a node is renamed
 * Replaces $('oldName') with $('newName') and $("oldName") with $("newName")
 * @param content - The string content to update
 * @param oldTitle - The old node title
 * @param newTitle - The new node title
 * @returns Updated string with replaced variable references
 */
const updateVariableReferences = (content: string, oldTitle: string, newTitle: string): string => {
  if (!ncIsString(content)) return content

  // Escape special regex characters in both titles
  const escapedOldTitle = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedNewTitle = newTitle.replace(/\$/g, '$$$$') // Escape $ for replacement string

  // Replace both single and double quoted references
  const singleQuoteRegex = new RegExp(`\\$\\('${escapedOldTitle}'\\)`, 'g')
  const doubleQuoteRegex = new RegExp(`\\$\\("${escapedOldTitle}"\\)`, 'g')

  let updated = content.replace(singleQuoteRegex, `$('${escapedNewTitle}')`)
  updated = updated.replace(doubleQuoteRegex, `$("${escapedNewTitle}")`)

  return updated
}
/**
 * Recursively update variable references in an object
 * @param obj - The object to update
 * @param oldTitle - The old node title
 * @param newTitle - The new node title
 * @returns Updated object with replaced variable references
 */
const updateVariableReferencesInObject = (obj: any, oldTitle: string, newTitle: string): any => {
  if (ncIsNullOrUndefined(obj)) return obj

  if (ncIsString(obj)) {
    return updateVariableReferences(obj, oldTitle, newTitle)
  }

  if (ncIsArray(obj)) {
    return obj.map((item) => updateVariableReferencesInObject(item, oldTitle, newTitle))
  }

  if (ncIsObject(obj)) {
    const updated: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        updated[key] = updateVariableReferencesInObject(obj[key], oldTitle, newTitle)
      }
    }
    return updated
  }

  return obj
}

export {
  filterNodesByPermission,
  getSourceNodesAndEdges,
  generateUniqueNodeId,
  generateTriggerId,
  transformNode,
  findAllParentNodes,
  prefixVariableKeysRecursive,
  generateUniqueNodeTitle,
  findAllChildNodes,
  findIterateNodePortForPath,
  updateVariableReferences,
  updateVariableReferencesInObject,
}

export type { UIWorkflowNodeDefinition }
