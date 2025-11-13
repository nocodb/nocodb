import type { Edge, Node } from '@vue-flow/core'

/**
 * Workflow execution result for a single node
 */
export interface NodeExecutionResult {
  nodeId: string
  nodeTitle: string
  status: 'pending' | 'running' | 'success' | 'error'
  output?: any
  error?: Error
  startTime?: number
  endTime?: number
}

/**
 * Workflow execution state
 */
export interface WorkflowExecutionState {
  id: string
  status: 'idle' | 'running' | 'completed' | 'error' | 'cancelled'
  startTime?: number
  endTime?: number
  nodeResults: Map<string, NodeExecutionResult>
  currentNodeId?: string
}

/**
 * Expression context for template interpolation
 * Provides access to previous node outputs via $('NodeTitle')
 */
export class ExpressionContext {
  private nodeResults: Map<string, NodeExecutionResult>
  private nodesByTitle: Map<string, Node>

  constructor(nodeResults: Map<string, NodeExecutionResult>, nodes: Node[]) {
    this.nodeResults = nodeResults
    this.nodesByTitle = new Map()
    
    // Build title -> node mapping
    nodes.forEach((node) => {
      const title = node.data?.title
      if (title) {
        this.nodesByTitle.set(title, node)
      }
    })
  }

  /**
   * Get output of a node by its title
   * Usage: $('Step 1').field or $('NocoDB').data.id
   */
  $(nodeTitle: string): any {
    const node = this.nodesByTitle.get(nodeTitle)
    if (!node) {
      throw new Error(`Node with title "${nodeTitle}" not found`)
    }

    const result = this.nodeResults.get(node.id)
    if (!result) {
      throw new Error(`Node "${nodeTitle}" has not been executed yet`)
    }

    if (result.status === 'error') {
      throw new Error(`Node "${nodeTitle}" failed with error: ${result.error?.message}`)
    }

    return result.output
  }
}

/**
 * Replace {{}} template expressions with actual values
 * Supports: {{ $('NodeTitle').field }}
 */
export function interpolateExpression(template: string, context: ExpressionContext): any {
  // If the entire value is a template expression, return the evaluated result directly
  const fullMatchRegex = /^\{\{\s*(.+?)\s*\}\}$/
  const fullMatch = template.match(fullMatchRegex)
  
  if (fullMatch) {
    const expression = fullMatch[1]
    try {
      // Create a function that evaluates the expression with the context
      // eslint-disable-next-line no-new-func
      const evaluator = new Function('$', `return ${expression}`)
      return evaluator(context.$.bind(context))
    } catch (error: any) {
      console.error(`Failed to evaluate expression: ${expression}`, error)
      throw new Error(`Expression evaluation failed: ${expression} - ${error.message}`)
    }
  }

  // For string interpolation with multiple templates
  const regex = /\{\{\s*(.+?)\s*\}\}/g
  return template.replace(regex, (match, expression) => {
    try {
      // eslint-disable-next-line no-new-func
      const evaluator = new Function('$', `return ${expression}`)
      const result = evaluator(context.$.bind(context))
      return String(result)
    } catch (error) {
      console.error(`Failed to evaluate expression: ${expression}`, error)
      return match // Return original if evaluation fails
    }
  })
}

/**
 * Recursively interpolate all string values in an object
 */
export function interpolateObject(obj: any, context: ExpressionContext): any {
  if (typeof obj === 'string') {
    return interpolateExpression(obj, context)
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, context))
  }

  if (obj && typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, context)
    }
    return result
  }

  return obj
}

/**
 * Build execution order from workflow graph
 * Returns array of node IDs in topological order
 */
export function buildExecutionOrder(nodes: Node[], edges: Edge[]): string[] {
  const order: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  // Build adjacency map
  const graph = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  nodes.forEach((node) => {
    graph.set(node.id, [])
    inDegree.set(node.id, 0)
  })

  edges.forEach((edge) => {
    const neighbors = graph.get(edge.source) || []
    neighbors.push(edge.target)
    graph.set(edge.source, neighbors)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  })

  // Topological sort using DFS
  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return
    if (visiting.has(nodeId)) {
      throw new Error('Workflow contains a cycle')
    }

    visiting.add(nodeId)

    const neighbors = graph.get(nodeId) || []
    neighbors.forEach((neighborId) => visit(neighborId))

    visiting.delete(nodeId)
    visited.add(nodeId)
    order.unshift(nodeId) // Prepend to get correct order
  }

  // Start from nodes with no incoming edges (typically the trigger)
  nodes.forEach((node) => {
    if ((inDegree.get(node.id) || 0) === 0) {
      visit(node.id)
    }
  })

  // Visit remaining nodes (in case of disconnected components)
  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      visit(node.id)
    }
  })

  return order
}

/**
 * Workflow Runner Composable
 */
export const useWorkflowRunner = () => {
  const executionState = ref<WorkflowExecutionState>({
    id: '',
    status: 'idle',
    nodeResults: new Map(),
  })

  const isRunning = computed(() => executionState.value.status === 'running')

  /**
   * Execute a single node
   */
  const executeNode = async (node: Node, context: ExpressionContext, workflowStore: any): Promise<NodeExecutionResult> => {
    const result: NodeExecutionResult = {
      nodeId: node.id,
      nodeTitle: node.data?.title || 'Untitled',
      status: 'running',
      startTime: Date.now(),
    }

    try {
      // Get node definition from backend
      const nodeDef = workflowStore.getBackendNodeDef(node.type)
      
      if (!nodeDef) {
        throw new Error(`Node type "${node.type}" not found`)
      }

      // Special handling for core nodes
      if (node.type === 'core.trigger') {
        // Trigger nodes just pass through - no execution needed
        result.status = 'success'
        result.output = { triggered: true }
        result.endTime = Date.now()
        return result
      }

      if (node.type === 'core.plus') {
        // Plus nodes are placeholders - skip execution
        result.status = 'success'
        result.output = {}
        result.endTime = Date.now()
        return result
      }

      // Interpolate node data with context
      const interpolatedData = interpolateObject(node.data, context)

      console.log('[WorkflowRunner] Executing node:', {
        id: node.id,
        type: node.type,
        title: node.data?.title,
        originalData: node.data,
        interpolatedData,
      })

      // TODO: Call actual node execution endpoint
      // For now, simulate execution
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Mock output based on node type
      let output: any = {}
      
      if (node.type.startsWith('nocodb.')) {
        // NocoDB nodes return data
        output = {
          success: true,
          data: { id: 'mock-id-123', ...interpolatedData },
        }
      } else if (node.type.startsWith('core.if')) {
        // Conditional nodes return boolean
        output = {
          result: true,
        }
      } else {
        // Default output
        output = { success: true }
      }

      result.status = 'success'
      result.output = output
      result.endTime = Date.now()
    } catch (error) {
      result.status = 'error'
      result.error = error as Error
      result.endTime = Date.now()
      console.error(`[WorkflowRunner] Node execution failed:`, error)
    }

    return result
  }

  /**
   * Execute the entire workflow
   */
  const runWorkflow = async (nodes: Node[], edges: Edge[], workflowStore: any, triggerData?: any) => {
    // Initialize execution state
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    executionState.value = {
      id: executionId,
      status: 'running',
      startTime: Date.now(),
      nodeResults: new Map(),
    }

    try {
      // Build execution order
      const executionOrder = buildExecutionOrder(nodes, edges)
      console.log('[WorkflowRunner] Execution order:', executionOrder)

      // Filter out plus nodes from execution
      const nodesToExecute = executionOrder.filter((nodeId) => {
        const node = nodes.find((n) => n.id === nodeId)
        return node && node.type !== 'core.plus'
      })

      // Execute nodes in order
      for (const nodeId of nodesToExecute) {
        const node = nodes.find((n) => n.id === nodeId)
        if (!node) continue

        executionState.value.currentNodeId = nodeId

        // Create expression context with current results
        const context = new ExpressionContext(executionState.value.nodeResults, nodes)

        // Add trigger data to context if it's the trigger node
        if (node.type === 'core.trigger' && triggerData) {
          const triggerResult: NodeExecutionResult = {
            nodeId: node.id,
            nodeTitle: node.data?.title || 'Trigger',
            status: 'success',
            output: triggerData,
            startTime: Date.now(),
            endTime: Date.now(),
          }
          executionState.value.nodeResults.set(nodeId, triggerResult)
          continue
        }

        // Execute node
        const result = await executeNode(node, context, workflowStore)
        executionState.value.nodeResults.set(nodeId, result)

        // Stop execution if node failed
        if (result.status === 'error') {
          executionState.value.status = 'error'
          executionState.value.endTime = Date.now()
          throw result.error
        }

        console.log('[WorkflowRunner] Node completed:', {
          nodeId,
          title: result.nodeTitle,
          duration: (result.endTime || 0) - (result.startTime || 0),
          output: result.output,
        })
      }

      // Mark execution as completed
      executionState.value.status = 'completed'
      executionState.value.endTime = Date.now()

      const duration = executionState.value.endTime - (executionState.value.startTime || 0)
      console.log('[WorkflowRunner] Workflow completed successfully in', duration, 'ms')

      message.success(`Workflow executed successfully in ${(duration / 1000).toFixed(2)}s`)
    } catch (error) {
      executionState.value.status = 'error'
      executionState.value.endTime = Date.now()
      console.error('[WorkflowRunner] Workflow execution failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      message.error(`Workflow execution failed: ${errorMessage}`)
      throw error
    }
  }

  /**
   * Cancel workflow execution
   */
  const cancelWorkflow = () => {
    if (executionState.value.status === 'running') {
      executionState.value.status = 'cancelled'
      executionState.value.endTime = Date.now()
      console.log('[WorkflowRunner] Workflow execution cancelled')
    }
  }

  /**
   * Reset execution state
   */
  const resetExecution = () => {
    executionState.value = {
      id: '',
      status: 'idle',
      nodeResults: new Map(),
    }
  }

  /**
   * Get result for a specific node
   */
  const getNodeResult = (nodeId: string): NodeExecutionResult | undefined => {
    return executionState.value.nodeResults.get(nodeId)
  }

  /**
   * Get all node results as array
   */
  const getAllResults = computed(() => {
    return Array.from(executionState.value.nodeResults.values())
  })

  return {
    // State
    executionState: readonly(executionState),
    isRunning,
    getAllResults,

    // Methods
    runWorkflow,
    cancelWorkflow,
    resetExecution,
    getNodeResult,
  }
}

export type WorkflowRunner = ReturnType<typeof useWorkflowRunner>
