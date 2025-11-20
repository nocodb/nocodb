import { Injectable, Logger } from '@nestjs/common';
import {
  GeneralNodeID,
  IntegrationsType,
  NOCO_SERVICE_USERS,
  ServiceUserType,
  WorkflowExpressionParser,
} from 'nocodb-sdk';
import type {
  NodeExecutionResult,
  WorkflowExecutionState,
  WorkflowGeneralEdge,
  WorkflowGeneralNode,
  WorkflowType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type {
  WorkflowNodeIntegration,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-local-integrations/core';
import { Integration } from '~/models';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { TablesService } from '~/services/tables.service';
import { NcError } from '~/helpers/ncError';
import {
  buildWorkflowGraph,
  determineStartNode,
  getNextNode,
} from '~/services/workflows/graphHelpers';
import { ExpressionContext } from '~/services/workflows/ExpressionContext';

@Injectable()
export class WorkflowExecutionService {
  private readonly logger = new Logger(WorkflowExecutionService.name);
  private readonly expressionParser = new WorkflowExpressionParser();

  constructor(
    private readonly dataV3Service: DataV3Service,
    private readonly tablesService: TablesService,
  ) {}

  public async getWorkflowNodes(context: NcContext) {
    const workflowNodeIntegrations = Integration.availableIntegrations.filter(
      (i) => i && i.type === IntegrationsType.WorkflowNode,
    );

    const nodes = [];
    for (const integration of workflowNodeIntegrations) {
      try {
        const instance = this.getNodeWrapper(context, integration.sub_type, {});

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
        console.error(
          `Failed to get definition for workflow node ${integration.sub_type}:`,
          error,
        );
      }
    }

    return { nodes };
  }

  public getNodeWrapper(
    context: NcContext,
    nodeType: string,
    nodeConfig: any,
  ): WorkflowNodeIntegration | null {
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
      return new integration.wrapper({
        ...nodeConfig,
        _nocodb: {
          context: {
            ...context,
            user: NOCO_SERVICE_USERS[ServiceUserType.WORKFLOW_USER],
          },
          dataService: this.dataV3Service,
          tablesService: this.tablesService,
          user: NOCO_SERVICE_USERS[ServiceUserType.WORKFLOW_USER],
        },
      }) as WorkflowNodeIntegration;
    } catch (error) {
      this.logger.error(
        `Failed to instantiate wrapper for ${nodeType}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Replace {{}} template expressions with actual values
   */
  private interpolateExpression(
    template: string,
    context: ExpressionContext,
  ): any {
    try {
      const contextData = context.getAllNodeOutputs();
      this.expressionParser.setContext(contextData);

      const fullMatchRegex = /^\{\{\s*(.+?)\s*}}$/;
      const fullMatch = template.match(fullMatchRegex);

      if (fullMatch) {
        const expression = fullMatch[1];
        return this.expressionParser.evaluate(expression);
      }

      return this.expressionParser.processString(template);
    } catch (error: any) {
      this.logger.error(`Failed to evaluate expression: ${template}`, error);
      throw new Error(
        `Expression evaluation failed: ${template} - ${error.message}`,
      );
    }
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

  private async executeNode(
    context: NcContext,
    node: WorkflowGeneralNode,
    expressionContext: ExpressionContext,
  ): Promise<NodeExecutionResult> {
    const result: NodeExecutionResult = {
      nodeId: node.id,
      nodeTitle: node.data?.title || 'Untitled',
      status: 'running',
      startTime: Date.now(),
    };

    try {
      if (node.type === GeneralNodeID.TRIGGER) {
        result.status = 'success';
        result.output = { triggered: true };
        result.endTime = Date.now();
        return result;
      }

      if (node.type === GeneralNodeID.PLUS) {
        result.status = 'success';
        result.output = {};
        result.endTime = Date.now();
        return result;
      }

      const nodeWrapper = this.getNodeWrapper(
        context,
        node.type,
        node.data?.config || {},
      );
      if (!nodeWrapper) {
        NcError.get(context).workflowNodeNotFound(node.type);
      }

      const interpolatedData = this.interpolateObject(
        node.data,
        expressionContext,
      );

      this.logger.debug(`Node data:`, JSON.stringify(interpolatedData));

      const runContext: WorkflowNodeRunContext = {
        workspaceId: context.workspace_id,
        baseId: context.base_id,
        inputs: interpolatedData || {},
      };

      const nodeResult: WorkflowNodeResult = await nodeWrapper.run(runContext);

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
      .slice(2, 9)}`;

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
      const nodes = (workflow.nodes || []) as WorkflowGeneralNode[];
      const edges = (workflow.edges || []) as WorkflowGeneralEdge[];

      if (nodes.length === 0) {
        NcError.get(context).workflowEmptyNode();
      }

      const nodeMap = new Map<string, WorkflowGeneralNode>(
        nodes.map((n) => [n.id, n]),
      );

      const { graph, triggerNodes } = buildWorkflowGraph(nodes, edges);

      let currentNodeId = determineStartNode(
        nodes,
        triggerNodes,
        triggerNodeTitle,
        context,
      );

      const executedNodes = new Set<string>();
      const maxIterations = nodes.length * 10;
      let iterations = 0;

      while (currentNodeId && iterations < maxIterations) {
        iterations++;

        // Detect cycles
        if (executedNodes.has(currentNodeId)) {
          this.logger.warn(`Cycle detected at node ${currentNodeId}`);
          break;
        }

        const node = nodeMap.get(currentNodeId);
        if (!node) {
          this.logger.error(`Node ${currentNodeId} not found in workflow`);
          break;
        }

        // Handle plus nodes
        if (node.type === GeneralNodeID.PLUS) {
          const outgoingEdges = graph.get(currentNodeId) || [];
          currentNodeId =
            outgoingEdges.length > 0 ? outgoingEdges[0].target : null;
          continue;
        }

        executedNodes.add(currentNodeId);
        executionState.currentNodeId = currentNodeId;

        // Create expression context
        const expressionContext = new ExpressionContext(
          executionState.nodeResults,
          nodes,
        );

        // Execute node
        const result = await this.executeNodeByType(
          context,
          node,
          triggerData,
          expressionContext,
        );

        executionState.nodeResults.push(result);

        if (result.status === 'error') {
          executionState.status = 'error';
          executionState.endTime = Date.now();
          NcError.get(context).workflowNodeExecutionFailed(
            result.nodeTitle,
            result.error,
          );
        }

        // Determine next node based on result
        currentNodeId = getNextNode(
          currentNodeId,
          result,
          graph,
          nodes,
          nodeMap,
          this.logger,
        );

        if (!currentNodeId) {
          break;
        }
      }

      if (iterations >= maxIterations) {
        NcError.get(context).workflowMaxIterationsExceeded();
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
      return this.handleExecutionError(executionState, error, workflow);
    }
  }

  private handleExecutionError(
    executionState: WorkflowExecutionState,
    error: any,
    workflow: WorkflowType,
  ): WorkflowExecutionState {
    executionState.status = 'error';
    executionState.endTime = Date.now();
    this.logger.error('Workflow execution failed:', error);

    // Add error result if not already present
    if (
      executionState.currentNodeId &&
      !executionState.nodeResults.find(
        (r) =>
          r.nodeId === executionState.currentNodeId && r.status === 'error',
      )
    ) {
      const nodes = (workflow as any).nodes || [];
      const node = nodes.find((n) => n.id === executionState.currentNodeId);
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

  private async executeNodeByType(
    context: NcContext,
    node: WorkflowGeneralNode,
    triggerData: any,
    expressionContext: ExpressionContext,
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    // Handle trigger nodes
    if (
      node.type === GeneralNodeID.TRIGGER ||
      node.type?.startsWith('nocodb.trigger.')
    ) {
      return this.executeTriggerNode(context, node, triggerData, startTime);
    }

    // Handle regular nodes
    return this.executeNode(context, node, expressionContext);
  }

  private async executeTriggerNode(
    context: NcContext,
    node: WorkflowGeneralNode,
    triggerData: any,
    startTime: number,
  ): Promise<NodeExecutionResult> {
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
          return {
            nodeId: node.id,
            nodeTitle: node.data?.title || 'Trigger',
            status: nodeResult.status === 'error' ? 'error' : 'success',
            output: nodeResult.outputs || {},
            startTime,
            endTime: Date.now(),
            logs: nodeResult.logs,
            metrics: nodeResult.metrics,
          };
        } catch (error) {
          this.logger.error(`Trigger node failed: ${node.id}`, error);
          return {
            nodeId: node.id,
            nodeTitle: node.data?.title || 'Trigger',
            status: 'error',
            error: error.message || 'Trigger execution failed',
            output: {},
            startTime,
            endTime: Date.now(),
          };
        }
      }
    }

    return {
      nodeId: node.id,
      nodeTitle: node.data?.title || 'Trigger',
      status: 'success',
      output: triggerData || {},
      startTime,
      endTime: Date.now(),
    };
  }
}
