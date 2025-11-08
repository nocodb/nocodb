import type { Node } from '@vue-flow/core'

export function useWorkflowValidation() {
  /**
   * Validates that a workflow has a trigger node
   * @param nodes - Array of workflow nodes
   * @returns True if workflow has a trigger node, false otherwise
   */
  const hasTriggerNode = (nodes: Node[]): boolean => {
    return nodes.some((node) => node.type === 'trigger')
  }

  /**
   * Validates that the trigger node has been configured
   * @param nodes - Array of workflow nodes
   * @returns True if trigger is configured, false otherwise
   */
  const isTriggerConfigured = (nodes: Node[]): boolean => {
    const triggerNode = nodes.find((node) => node.type === 'trigger')
    return !!triggerNode?.data?.triggerId
  }

  /**
   * Gets the trigger node from the workflow
   * @param nodes - Array of workflow nodes
   * @returns The trigger node or undefined
   */
  const getTriggerNode = (nodes: Node[]): Node | undefined => {
    return nodes.find((node) => node.type === 'trigger')
  }

  /**
   * Ensures a workflow has exactly one trigger node
   * @param nodes - Array of workflow nodes
   * @returns True if workflow has exactly one trigger, false otherwise
   */
  const hasExactlyOneTrigger = (nodes: Node[]): boolean => {
    const triggerNodes = nodes.filter((node) => node.type === 'trigger')
    return triggerNodes.length === 1
  }

  /**
   * Validates the entire workflow before saving
   * @param nodes - Array of workflow nodes
   * @returns Validation result with errors if any
   */
  const validateWorkflow = (nodes: Node[]): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (!hasTriggerNode(nodes)) {
      errors.push('Workflow must have a trigger node')
    } else if (!hasExactlyOneTrigger(nodes)) {
      errors.push('Workflow must have exactly one trigger node')
    } else if (!isTriggerConfigured(nodes)) {
      errors.push('Trigger must be configured before saving')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Creates a default trigger node
   * @returns A new trigger node with default configuration
   */
  const createDefaultTriggerNode = (): Node => {
    return {
      id: `trigger-${Date.now()}`,
      type: 'trigger',
      position: { x: 250, y: 50 },
      data: {
        label: 'When this happens',
        triggerId: null,
      },
    }
  }

  return {
    hasTriggerNode,
    isTriggerConfigured,
    getTriggerNode,
    hasExactlyOneTrigger,
    validateWorkflow,
    createDefaultTriggerNode,
  }
}
