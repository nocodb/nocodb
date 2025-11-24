import type { NodeExecutionResult, WorkflowGeneralNode } from 'nocodb-sdk';

class ExpressionContext {
  private nodeResults: Map<string, NodeExecutionResult>;
  private nodesByTitle: Map<string, WorkflowGeneralNode>;
  private isTestCall = false;

  constructor(
    nodeResults: NodeExecutionResult[],
    nodes: WorkflowGeneralNode[],
    isTestCall = false,
  ) {
    this.nodeResults = new Map();

    this.isTestCall = isTestCall;
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
   * Includes test results if test run
   */
  getAllNodeOutputs(): Record<string, unknown> {
    const contextData: Record<string, unknown> = {};

    if (this.isTestCall) {
      this.nodesByTitle.forEach((node, title) => {
        if (node.data?.testResult?.status === 'success') {
          contextData[title] = node.data.testResult.output;
        }
      });

      return contextData;
    }
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
