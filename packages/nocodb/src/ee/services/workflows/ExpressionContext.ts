import type { NodeExecutionResult, WorkflowGeneralNode } from 'nocodb-sdk';

class ExpressionContext {
  private nodeResults: Map<string, NodeExecutionResult>;
  private nodesByTitle: Map<string, WorkflowGeneralNode>;

  constructor(
    nodeResults: NodeExecutionResult[],
    nodes: WorkflowGeneralNode[],
  ) {
    this.nodeResults = new Map();
    nodeResults.forEach((result) => {
      this.nodeResults.set(result.nodeId, result);
    });

    this.nodesByTitle = new Map();
    nodes.forEach((node) => {
      const title = node.data?.title;
      if (title) {
        this.nodesByTitle.set(title, node);
      }
    });
  }

  /**
   * Get all node outputs as a context object for the parser
   */
  getAllNodeOutputs(): Record<string, unknown> {
    const contextData: Record<string, unknown> = {};

    this.nodeResults.forEach((result) => {
      const node = this.nodesByTitle.get(result.nodeTitle);
      if (node && result.status === 'success') {
        contextData[result.nodeTitle] = result.output;
      }
    });

    return contextData;
  }
}

export { ExpressionContext };
