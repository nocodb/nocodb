import type { Node } from '@vue-flow/core'
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

export { generateUniqueNodeId, transformNode }
