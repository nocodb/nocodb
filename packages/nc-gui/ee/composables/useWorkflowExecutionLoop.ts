/**
 * State management for loop iteration navigation
 * Each loop node can have its own current iteration state
 */
const loopIterations = ref<Record<string, number>>({})

export function useWorkflowExecutionLoop() {
  /**
   * Get current iteration for a specific loop
   */
  const getCurrentIteration = (loopNodeId: string): number => {
    return loopIterations.value[loopNodeId] ?? 0
  }

  /**
   * Set current iteration for a specific loop
   */
  const setCurrentIteration = (loopNodeId: string, iteration: number) => {
    loopIterations.value[loopNodeId] = iteration
  }

  /**
   * Navigate to previous iteration
   */
  const goToPreviousIteration = (loopNodeId: string) => {
    const current = getCurrentIteration(loopNodeId)
    if (current > 0) {
      setCurrentIteration(loopNodeId, current - 1)
    }
  }

  /**
   * Navigate to next iteration
   */
  const goToNextIteration = (loopNodeId: string, maxIterations: number) => {
    const current = getCurrentIteration(loopNodeId)
    if (current < maxIterations - 1) {
      setCurrentIteration(loopNodeId, current + 1)
    }
  }

  /**
   * Reset all iterations (e.g., when viewing a different execution)
   */
  const resetAllIterations = () => {
    loopIterations.value = {}
  }

  /**
   * Recursively search for a node in loop iterations (handles nested loops)
   */
  const searchLoopsForNode = (loopsObj: any, nodeId: string, parentPath: any[] = []): any => {
    for (const [loopId, loopData] of Object.entries(loopsObj)) {
      const currentPath = [...parentPath, { loopId, loopData }]

      // Check iterations for this node
      for (const iteration of Object.values((loopData as any).iterations)) {
        const nodeResult = (iteration as any).nodeResults.find((r: any) => r.nodeId === nodeId)
        if (nodeResult) {
          return currentPath
        }

        // Recursively search child loops
        if ((iteration as any).childLoops) {
          const childResult = searchLoopsForNode((iteration as any).childLoops, nodeId, currentPath)
          if (childResult) return childResult
        }
      }
    }

    return null
  }

  /**
   * Get loop info for a specific node (finds which loop it belongs to, supports nesting)
   */
  const getNodeLoopInfo = (nodeId: string, executionData: any) => {
    if (!executionData?.loops) return null

    const loopPath = searchLoopsForNode(executionData.loops, nodeId)
    if (!loopPath) return null

    // Return info for the innermost (leaf) loop
    const leafLoop = loopPath[loopPath.length - 1]
    return {
      loopNodeId: leafLoop.loopId,
      loopNodeTitle: leafLoop.loopData.nodeTitle,
      totalIterations: leafLoop.loopData.totalIterations,
      currentIteration: getCurrentIteration(leafLoop.loopId),
      loopPath, // Full hierarchy for nested navigation
    }
  }

  /**
   * Get loop data by navigating the nested structure
   */
  const getLoopDataByPath = (executionData: any, loopPath: any[]): any => {
    if (!loopPath || loopPath.length === 0) return null

    let current = executionData.loops[loopPath[0].loopId]

    for (let i = 1; i < loopPath.length; i++) {
      const parentLoop = loopPath[i - 1]
      const parentIteration = getCurrentIteration(parentLoop.loopId)
      const childLoopId = loopPath[i].loopId

      if (!current.iterations[parentIteration]?.childLoops?.[childLoopId]) {
        return null
      }

      current = current.iterations[parentIteration].childLoops[childLoopId]
    }

    return current
  }

  /**
   * Get result for a specific node at the current iteration (supports nesting)
   */
  const getNodeResultAtCurrentIteration = (nodeId: string, executionData: any) => {
    const loopInfo = getNodeLoopInfo(nodeId, executionData)

    if (loopInfo) {
      // Node is inside a loop, navigate nested structure
      const loopData = getLoopDataByPath(executionData, loopInfo.loopPath)
      if (!loopData) return null

      const iteration = loopData.iterations[loopInfo.currentIteration]
      return iteration?.nodeResults.find((r: any) => r.nodeId === nodeId)
    }

    // Not in a loop, return from main nodeResults
    return executionData.nodeResults.find((r: any) => r.nodeId === nodeId)
  }

  /**
   * Check if a node is a loop node
   */
  const isLoopNode = (nodeType: string): boolean => {
    return nodeType === 'core.flow.iterate' || nodeType.includes('loop')
  }

  return {
    getCurrentIteration,
    setCurrentIteration,
    goToPreviousIteration,
    goToNextIteration,
    resetAllIterations,
    getNodeLoopInfo,
    getNodeResultAtCurrentIteration,
    isLoopNode,
  }
}
