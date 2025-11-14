import { Injectable, Logger } from '@nestjs/common';
import { IntegrationsType, type WorkflowType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type {
  WorkflowNodeIntegration,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-local-integrations/core';
import { Integration } from '~/models';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { TablesService } from '~/services/tables.service';

export interface NodeExecutionResult {
  nodeId: string;
  nodeTitle: string;
  status: 'pending' | 'running' | 'success' | 'error';
  output?: any;
  error?: string;
  startTime: number;
  endTime?: number;
  nextNode?: string; // Next node to execute (for conditional branching)
  logs?: Array<{
    level: 'info' | 'warn' | 'error';
    message: string;
    ts?: number;
    data?: any;
  }>;
  metrics?: Record<string, number>;
}

export interface WorkflowExecutionState {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  startTime: number;
  endTime?: number;
  nodeResults: NodeExecutionResult[];
  currentNodeId?: string;
  triggerData?: any;
  triggerNodeTitle?: string; // Optional: which trigger node to start from
}

class ExpressionContext {
  private nodeResults: Map<string, NodeExecutionResult>;
  private nodesByTitle: Map<string, any>;

  constructor(nodeResults: NodeExecutionResult[], nodes: any[]) {
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
   * Get output of a node by its title
   * Usage: $('Step 1').field or $('NocoDB').data.id
   */
  $(nodeTitle: string): any {
    const node = this.nodesByTitle.get(nodeTitle);
    if (!node) {
      throw new Error(`Node with title "${nodeTitle}" not found`);
    }

    const result = this.nodeResults.get(node.id);
    if (!result) {
      throw new Error(`Node "${nodeTitle}" has not been executed yet`);
    }

    if (result.status === 'error') {
      throw new Error(`Node "${nodeTitle}" failed with error: ${result.error}`);
    }

    return result.output;
  }
}

@Injectable()
export class WorkflowExecutionService {
  protected logger = new Logger(WorkflowExecutionService.name);

  constructor(
    private readonly dataV3Service: DataV3Service,
    private readonly tablesService: TablesService,
  ) {}

  public getNodeWrapper(
    context: NcContext,
    nodeType: string,
    nodeConfig: any,
  ): WorkflowNodeIntegration | null {
    // Find the integration that matches this node type
    const integration = Integration.availableIntegrations.find(
      (i) =>
        i &&
        i.type === IntegrationsType.WorkflowNode &&
        i.sub_type &&
        i.sub_type === nodeType &&
        i.wrapper,
    );

    if (!integration || !integration.wrapper) {
      return null;
    }

    try {
      // Instantiate the wrapper with config AND services
      // Pass services through the config so they're available to all methods
      const wrapper = new integration.wrapper({
        ...nodeConfig,
        _nocodb: {
          context,
          dataService: this.dataV3Service,
          tablesService: this.tablesService,
        },
      }) as WorkflowNodeIntegration;
      return wrapper;
    } catch (error) {
      this.logger.error(
        `Failed to instantiate wrapper for ${nodeType}:`,
        error,
      );
      return null;
    }
  }

  public async getWorkflowNodes(context: NcContext) {
    // Filter integrations by type WorkflowNode
    const workflowNodeIntegrations = Integration.availableIntegrations.filter(
      (i) => i && i.type === IntegrationsType.WorkflowNode,
    );

    // For each integration, get the node definition using the Integration helper
    const nodes = [];
    for (const integration of workflowNodeIntegrations) {
      try {
        // Use Integration.tempIntegrationWrapper to properly instantiate the node
        const instance = this.getNodeWrapper(context, integration.sub_type, {});

        // Check if it has a definition method (workflow nodes should)
        if (typeof instance.definition === 'function') {
          const definition = await instance.definition();
          nodes.push({
            ...definition,
            source: {
              type: integration.type,
              subType: integration.sub_type,
            },
          });
        }
      } catch (error) {
        // Skip nodes that fail to instantiate
        console.error(
          `Failed to get definition for workflow node ${integration.sub_type}:`,
          error,
        );
      }
    }

    return { nodes };
  }

  /**
   * Replace {{}} template expressions with actual values
   */
  private interpolateExpression(
    template: string,
    context: ExpressionContext,
  ): any {
    // If the entire value is a template expression, return the evaluated result directly
    const fullMatchRegex = /^\{\{\s*(.+?)\s*\}\}$/;
    const fullMatch = template.match(fullMatchRegex);

    if (fullMatch) {
      const expression = fullMatch[1];
      try {
        // Create a function that evaluates the expression with the context
        const evaluator = new Function('$', `return ${expression}`);
        return evaluator(context.$.bind(context));
      } catch (error: any) {
        this.logger.error(
          `Failed to evaluate expression: ${expression}`,
          error,
        );
        throw new Error(
          `Expression evaluation failed: ${expression} - ${error.message}`,
        );
      }
    }

    // For string interpolation with multiple templates
    const regex = /\{\{\s*(.+?)\s*\}\}/g;
    return template.replace(regex, (match, expression) => {
      try {
        const evaluator = new Function('$', `return ${expression}`);
        const result = evaluator(context.$.bind(context));

        // Properly stringify objects and arrays for interpolation
        if (typeof result === 'object' && result !== null) {
          // Use JSON.stringify and escape double quotes for nested JSON usage
          return JSON.stringify(result).replace(/"/g, '\\"');
        }

        return String(result);
      } catch (error) {
        this.logger.error(
          `Failed to evaluate expression: ${expression}`,
          error,
        );
        return match; // Return original if evaluation fails
      }
    });
  }

  private interpolateObject(obj: any, context: ExpressionContext): any {
    if (typeof obj === 'string') {
      return this.interpolateExpression(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.interpolateObject(item, context));
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateObject(value, context);
      }
      return result;
    }

    return obj;
  }

  private buildGraphStructure(nodes: any[], edges: any[]) {
    // Build adjacency map
    const graph = new Map<string, any[]>();
    const reverseGraph = new Map<string, any[]>(); // parent -> children
    const inDegree = new Map<string, number>();

    nodes.forEach((node) => {
      graph.set(node.id, []);
      reverseGraph.set(node.id, []);
      inDegree.set(node.id, 0);
    });

    edges.forEach((edge) => {
      // Store edge with label for conditional branching
      const edgeData = {
        target: edge.target,
        label: edge.label, // For conditional branches (e.g., "true", "false")
      };

      const neighbors = graph.get(edge.source) || [];
      neighbors.push(edgeData);
      graph.set(edge.source, neighbors);

      const parents = reverseGraph.get(edge.target) || [];
      parents.push({ source: edge.source, label: edge.label });
      reverseGraph.set(edge.target, parents);

      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });

    // Find trigger nodes (nodes with no incoming edges)
    const triggerNodes = nodes.filter(
      (node) => (inDegree.get(node.id) || 0) === 0,
    );

    return { graph, reverseGraph, inDegree, triggerNodes };
  }

  private getNextNode(
    currentNodeId: string,
    currentResult: NodeExecutionResult,
    graph: Map<string, any[]>,
    nodes: any[],
  ): string | null {
    const currentNode = nodes.find((n) => n.id === currentNodeId);
    const outgoingEdges = graph.get(currentNodeId) || [];

    // 1. Explicit routing: Node explicitly specifies next node by title
    if (currentResult.nextNode) {
      const nextNode = nodes.find(
        (n) => n.data?.title === currentResult.nextNode,
      );
      if (nextNode) {
        this.logger.debug(
          `Routing to explicitly specified node: "${currentResult.nextNode}"`,
        );
        return nextNode.id;
      }
      this.logger.warn(
        `Next node "${currentResult.nextNode}" not found, falling back to edge-based routing`,
      );
    }

    // 2. End of flow: No outgoing edges
    if (outgoingEdges.length === 0) {
      this.logger.debug('No outgoing edges, ending workflow');
      return null;
    }

    // 3. Linear flow: Single outgoing edge
    if (outgoingEdges.length === 1) {
      return outgoingEdges[0].target;
    }

    // 4. Conditional flow: Multiple outgoing edges - use node-specific logic
    return this.resolveConditionalBranch(
      currentNode,
      currentResult,
      outgoingEdges,
    );
  }

  private resolveConditionalBranch(
    currentNode: any,
    currentResult: NodeExecutionResult,
    outgoingEdges: any[],
  ): string | null {
    const nodeType = currentNode?.type;

    if (!nodeType) {
      this.logger.warn(
        `Node ${currentNode?.id} has no type, taking first edge`,
      );
      return outgoingEdges[0].target;
    }

    if (nodeType === 'core.flow.if') {
      return this.resolveIfNodeBranch(currentResult, outgoingEdges);
    }

    // Unknown branching node - log warning and take first edge
    this.logger.warn(
      `Node type "${nodeType}" has multiple edges but no branching logic defined, taking first edge`,
    );
    return outgoingEdges[0]?.target || null;
  }

  private resolveIfNodeBranch(
    result: NodeExecutionResult,
    outgoingEdges: any[],
  ): string | null {
    const conditionResult = result.output?.result;

    // Handle boolean result
    if (typeof conditionResult === 'boolean') {
      const targetLabel = conditionResult ? 'true' : 'false';
      const matchingEdge = outgoingEdges.find(
        (edge) => edge.label?.toLowerCase() === targetLabel,
      );

      if (matchingEdge) {
        this.logger.debug(
          `If condition evaluated to ${conditionResult}, taking "${targetLabel}" branch`,
        );
        return matchingEdge.target;
      }

      this.logger.warn(
        `No edge found with label "${targetLabel}", looking for default branch`,
      );
    } else {
      this.logger.warn(
        `If node result is not boolean (got ${typeof conditionResult}), looking for default branch`,
      );
    }

    // Fallback: Try to find default or false edge
    const fallbackEdge = outgoingEdges.find(
      (edge) =>
        edge.label?.toLowerCase() === 'default' ||
        edge.label?.toLowerCase() === 'false',
    );

    if (fallbackEdge) {
      this.logger.debug('Taking fallback branch: default/false');
      return fallbackEdge.target;
    }

    // Last resort: take first edge
    this.logger.warn('No matching branch found, taking first edge');
    return outgoingEdges[0]?.target || null;
  }

  private async executeNode(
    context: NcContext,
    node: any,
    expressionContext: ExpressionContext,
  ): Promise<NodeExecutionResult> {
    const result: NodeExecutionResult = {
      nodeId: node.id,
      nodeTitle: node.data?.title || 'Untitled',
      status: 'running',
      startTime: Date.now(),
    };

    try {
      // Handle special core nodes
      if (node.type === 'core.trigger') {
        // Trigger nodes just pass through
        result.status = 'success';
        result.output = { triggered: true };
        result.endTime = Date.now();
        return result;
      }

      if (node.type === 'core.plus') {
        // Plus nodes are placeholders - skip
        result.status = 'success';
        result.output = {};
        result.endTime = Date.now();
        return result;
      }

      // Get node wrapper with services injected
      const nodeWrapper = this.getNodeWrapper(
        context,
        node.type,
        node.data?.config || {},
      );
      if (!nodeWrapper) {
        throw new Error(`Node type "${node.type}" not found or not executable`);
      }

      // Interpolate node data with context
      const interpolatedData = this.interpolateObject(
        node.data,
        expressionContext,
      );

      this.logger.debug(`Node data:`, JSON.stringify(interpolatedData));

      // Prepare run context (no need to pass services here anymore)
      const runContext: WorkflowNodeRunContext = {
        workspaceId: context.workspace_id,
        baseId: context.base_id,
        inputs: interpolatedData || {},
      };

      // Execute the node using the run() method
      // Cast to any since WorkflowNodeIntegration extends IntegrationWrapper
      const nodeResult: WorkflowNodeResult = await nodeWrapper.run(runContext);

      // Map WorkflowNodeResult to NodeExecutionResult
      result.status = nodeResult.status === 'error' ? 'error' : 'success';
      result.output = nodeResult.outputs;
      result.logs = nodeResult.logs;
      result.metrics = nodeResult.metrics;
      result.endTime = Date.now();

      if (nodeResult.status === 'error' && nodeResult.error) {
        result.error = nodeResult.error.message;
        result.status = 'error';
      }
    } catch (error) {
      result.status = 'error';
      result.error = error.message || 'Unknown error';
      result.endTime = Date.now();
      this.logger.error(`Node execution failed: ${node.id}`, error);
    }

    return result;
  }

  async executeWorkflow(
    context: NcContext,
    workflow: WorkflowType,
    triggerData?: any,
    triggerNodeTitle?: string,
  ): Promise<WorkflowExecutionState> {
    const executionId = `exec-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const executionState: WorkflowExecutionState = {
      id: executionId,
      workflowId: workflow.id,
      status: 'running',
      startTime: Date.now(),
      nodeResults: [],
      triggerData,
      triggerNodeTitle,
    };

    try {
      const nodes = (workflow as any).nodes || [];
      const edges = (workflow as any).edges || [];

      if (nodes.length === 0) {
        throw new Error('Workflow has no nodes');
      }

      // Build graph structure
      const { graph, triggerNodes } = this.buildGraphStructure(nodes, edges);

      // Determine starting node
      let currentNodeId: string | null = null;

      if (triggerNodeTitle) {
        // Find trigger node by title
        const triggerNode = nodes.find(
          (n) =>
            n.data?.title === triggerNodeTitle || n.type === 'core.trigger',
        );
        if (triggerNode) {
          currentNodeId = triggerNode.id;
        } else {
          throw new Error(`Trigger node "${triggerNodeTitle}" not found`);
        }
      } else {
        // Use first trigger node or first node in workflow
        if (triggerNodes.length > 0) {
          currentNodeId = triggerNodes[0].id;
        } else {
          currentNodeId = nodes[0].id;
        }
      }

      // Execute nodes following the workflow path
      const executedNodes = new Set<string>();
      const maxIterations = nodes.length * 10; // Prevent infinite loops
      let iterations = 0;

      while (currentNodeId && iterations < maxIterations) {
        iterations++;

        // Prevent cycles
        if (executedNodes.has(currentNodeId)) {
          this.logger.warn(
            `Cycle detected: node ${currentNodeId} already executed`,
          );
          break;
        }

        const node = nodes.find((n) => n.id === currentNodeId);
        if (!node) {
          this.logger.error(`Node ${currentNodeId} not found in workflow`);
          break;
        }

        // Skip plus nodes
        if (node.type === 'core.plus') {
          // Move to next node
          const outgoingEdges = graph.get(currentNodeId) || [];
          currentNodeId =
            outgoingEdges.length > 0 ? outgoingEdges[0].target : null;
          continue;
        }

        executedNodes.add(currentNodeId);
        executionState.currentNodeId = currentNodeId;

        // Create expression context with current results
        const expressionContext = new ExpressionContext(
          executionState.nodeResults,
          nodes,
        );

        // Handle trigger nodes with trigger data
        if (
          node.type === 'core.trigger' ||
          node.type?.startsWith('nocodb.trigger.')
        ) {
          // For custom trigger nodes, execute them with trigger data as inputs
          if (node.type?.startsWith('nocodb.trigger.')) {
            const nodeWrapper = this.getNodeWrapper(
              context,
              node.type,
              node.data?.config || {},
            );

            if (nodeWrapper) {
              const runContext: WorkflowNodeRunContext = {
                workspaceId: context.workspace_id,
                baseId: context.base_id,
                inputs: triggerData || {},
                user: (triggerData as any)?.user,
              };

              try {
                const nodeResult = await nodeWrapper.run(runContext);
                const triggerResult: NodeExecutionResult = {
                  nodeId: node.id,
                  nodeTitle: node.data?.title || 'Trigger',
                  status: nodeResult.status === 'error' ? 'error' : 'success',
                  output: nodeResult.outputs || {},
                  startTime: Date.now(),
                  endTime: Date.now(),
                  logs: nodeResult.logs,
                  metrics: nodeResult.metrics,
                };

                executionState.nodeResults.push(triggerResult);

                // Move to next node
                currentNodeId = this.getNextNode(
                  currentNodeId,
                  triggerResult,
                  graph,
                  nodes,
                );
                continue;
              } catch (error) {
                this.logger.error(
                  `Trigger node execution failed: ${node.id}`,
                  error,
                );
                const triggerResult: NodeExecutionResult = {
                  nodeId: node.id,
                  nodeTitle: node.data?.title || 'Trigger',
                  status: 'error',
                  error: error.message || 'Trigger execution failed',
                  output: {},
                  startTime: Date.now(),
                  endTime: Date.now(),
                };
                executionState.nodeResults.push(triggerResult);
                executionState.status = 'error';
                executionState.endTime = Date.now();
                throw error;
              }
            }
          }

          // Default trigger handling (core.trigger)
          const triggerResult: NodeExecutionResult = {
            nodeId: node.id,
            nodeTitle: node.data?.title || 'Trigger',
            status: 'success',
            output: triggerData || {},
            startTime: Date.now(),
            endTime: Date.now(),
          };
          executionState.nodeResults.push(triggerResult);

          // Move to next node
          currentNodeId = this.getNextNode(
            currentNodeId,
            triggerResult,
            graph,
            nodes,
          );
          continue;
        }

        // Execute node
        const result = await this.executeNode(context, node, expressionContext);
        executionState.nodeResults.push(result);

        // Stop execution if node failed
        if (result.status === 'error') {
          executionState.status = 'error';
          executionState.endTime = Date.now();
          throw new Error(`Node "${result.nodeTitle}" failed: ${result.error}`);
        }

        // Determine next node based on result
        currentNodeId = this.getNextNode(currentNodeId, result, graph, nodes);

        if (!currentNodeId) {
          break;
        }
      }

      if (iterations >= maxIterations) {
        throw new Error(
          'Maximum iteration limit reached - possible infinite loop',
        );
      }

      // Mark execution as completed
      executionState.status = 'completed';
      executionState.endTime = Date.now();

      const duration = executionState.endTime - executionState.startTime;
      this.logger.log(
        `Workflow completed successfully in ${duration}ms (${executedNodes.size} nodes executed)`,
      );

      return executionState;
    } catch (error) {
      executionState.status = 'error';
      executionState.endTime = Date.now();
      this.logger.error('Workflow execution failed:');
      this.logger.error(error);

      // If we don't have an error result yet, add one
      if (
        executionState.currentNodeId &&
        !executionState.nodeResults.find(
          (r) =>
            r.nodeId === executionState.currentNodeId && r.status === 'error',
        )
      ) {
        const node = ((workflow as any).nodes || []).find(
          (n) => n.id === executionState.currentNodeId,
        );
        if (node) {
          executionState.nodeResults.push({
            nodeId: node.id,
            nodeTitle: node.data?.title || 'Untitled',
            status: 'error',
            error: error.message,
            startTime: Date.now(),
            endTime: Date.now(),
          });
        }
      }

      return executionState;
    }
  }
}
