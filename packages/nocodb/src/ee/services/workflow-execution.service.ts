import { Injectable, Logger } from '@nestjs/common';
import {
  findVariableByPath,
  GeneralNodeID,
  genGeneralVariables,
  IntegrationsType,
  isTriggerNode,
  NcBaseError,
  NOCO_SERVICE_USERS,
  parseWorkflowVariableExpression,
  ServiceUserType,
  VariableType,
  WorkflowExpressionParser,
} from 'nocodb-sdk';
import rfdc from 'rfdc';
import type {
  LoopContext,
  NodeExecutionResult,
  VariableDefinition,
  VariableGeneratorContext,
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
import type { Graph } from '~/services/workflows/graphHelpers';
import { Column, Integration } from '~/models';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { TablesService } from '~/services/tables.service';
import { NcError } from '~/helpers/ncError';
import {
  buildWorkflowGraph,
  determineStartNode,
  findParentLoops,
  findParentNodes,
  getNextNode,
} from '~/services/workflows/graphHelpers';
import { ExpressionContext } from '~/services/workflows/ExpressionContext';
import { MailService } from '~/services/mail/mail.service';
import { getBaseSchema } from '~/helpers/scriptHelper';
import { genJwt } from '~/services/users/helpers';
import Noco from '~/Noco';

const deepClone = rfdc();

interface ActiveLoop extends LoopContext {
  // Runtime node identification
  nodeId: string;
  nodeTitle: string;

  // Runtime navigation (resolved edge targets)
  bodyStartNodeId: string | null;
  exitNodeId: string | null;
}

@Injectable()
export class WorkflowExecutionService {
  private readonly logger = new Logger(WorkflowExecutionService.name);
  private readonly expressionParser = new WorkflowExpressionParser();

  private getVariableGeneratorContext(
    context: NcContext,
    nodes?: WorkflowGeneralNode[],
  ): VariableGeneratorContext {
    return {
      getColumn: (columnId: string) => Column.get(context, { colId: columnId }),
      getTableColumns: (tableId: string) =>
        Column.list(context, { fk_model_id: tableId }),
      inferSchemaFromExpression: async (expression: string) => {
        return this.inferSchemaFromExpression(expression, nodes);
      },
    };
  }

  /**
   * Get loop data from nested structure based on loop hierarchy
   * Navigates through parent loops to find the correct loop data
   */
  private getLoopData(
    executionState: WorkflowExecutionState,
    activeLoops: ActiveLoop[],
  ): any {
    if (activeLoops.length === 0) return null;

    // Start with top-level loop
    let loopData = executionState.loops[activeLoops[0].nodeId];

    // Navigate through nested loops
    for (let i = 1; i < activeLoops.length; i++) {
      const parentLoop = activeLoops[i - 1];
      const currentLoopId = activeLoops[i].nodeId;
      const parentIteration =
        loopData.iterations[parentLoop.state.currentIndex];

      if (!parentIteration?.childLoops?.[currentLoopId]) {
        return null;
      }

      loopData = parentIteration.childLoops[currentLoopId];
    }

    return loopData;
  }

  /**
   * Infer schema from a workflow expression by analyzing referenced nodes
   */
  private async inferSchemaFromExpression(
    expression: string,
    nodes?: WorkflowGeneralNode[],
  ): Promise<VariableDefinition[] | undefined> {
    try {
      if (!nodes) return undefined;

      const variableInfo = parseWorkflowVariableExpression(expression);
      if (!variableInfo) return undefined;

      const { nodeTitle, variablePath } = variableInfo;

      // Find the referenced node
      const referencedNode = nodes.find(
        (n: any) => n.data?.title === nodeTitle,
      );
      if (!referencedNode) return undefined;

      // Get its output variables (from test results or stored config)
      const outputVars =
        (referencedNode as any).data?.testResult?.outputVariables ||
        (referencedNode as any).data?.outputVariables;
      if (!outputVars) return undefined;

      // Find the specific variable at variablePath
      const variable = findVariableByPath(variablePath, outputVars);
      if (!variable) return undefined;

      // Extract itemSchema from array variable
      if (variable.isArray || variable.type === VariableType.Array) {
        return variable.extra?.itemSchema;
      }

      return undefined;
    } catch {
      // If static analysis fails, return undefined
      return undefined;
    }
  }

  constructor(
    private readonly dataV3Service: DataV3Service,
    private readonly tablesService: TablesService,
    private readonly mailService: MailService,
  ) {}

  public async getWorkflowNodes(context: NcContext) {
    const workflowNodeIntegrations = Integration.availableIntegrations
      .filter(
        (i) =>
          i && i.type === IntegrationsType.WorkflowNode && !i.manifest.hidden,
      )
      .sort((a, b) => {
        if (a.manifest.order && b.manifest.order) {
          return a.manifest.order - b.manifest.order;
        }
        return 0;
      });

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

    const getAuthIntegration = async (integrationId: string) => {
      if (!integrationId) {
        NcError.get(context).badRequest('Integration ID is required');
      }

      const integration = await Integration.get(context, integrationId);
      if (!integration) {
        NcError.get(context).integrationNotFound(integrationId);
      }

      const authWrapper = await integration.getIntegrationWrapper();

      if (typeof authWrapper.authenticate === 'function') {
        await authWrapper.authenticate();
      }

      return authWrapper;
    };

    let nodeWrapper;

    try {
      nodeWrapper = new integration.wrapper(
        {
          ...nodeConfig,
          _nocodb: {
            context: {
              ...context,
              nc_site_url: context.nc_site_url,
              user: NOCO_SERVICE_USERS[ServiceUserType.WORKFLOW_USER],
            },
            dataService: this.dataV3Service,
            tablesService: this.tablesService,
            mailService: this.mailService,
            user: NOCO_SERVICE_USERS[ServiceUserType.WORKFLOW_USER],
            getBaseSchema: async () => await getBaseSchema(context),
            getAccessToken: () =>
              genJwt(
                {
                  ...NOCO_SERVICE_USERS[ServiceUserType.WORKFLOW_USER],
                  extra: {
                    context: context,
                  },
                },
                Noco.getConfig(),
                {
                  expiresIn: '3m',
                },
              ),
          },
        },
        {},
      ) as WorkflowNodeIntegration;

      // Inject auth loader into node instance
      if (typeof nodeWrapper.setAuthLoader === 'function') {
        nodeWrapper.setAuthLoader(getAuthIntegration);
      }
    } catch (e) {
      this.logger.error(`Failed to instantiate wrapper for ${nodeType}:`, e);
      return null;
    }

    return nodeWrapper;
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
      this.expressionParser.setContext(deepClone(contextData));

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

  /**
   * Check if a node is a delay/wait node
   * Delay nodes return resumeAt timestamp in their output
   */
  private isDelayNode(
    node: WorkflowGeneralNode,
    result: NodeExecutionResult,
  ): boolean {
    // Check if it's a delay or wait-until node type
    const isDelayNodeType =
      node.type === 'core.flow.delay' || node.type === 'core.flow.wait-until';

    // Verify it succeeded and has a valid future resumeAt timestamp
    return (
      isDelayNodeType &&
      result.status === 'success' &&
      result.output &&
      typeof result.output.resumeAt === 'number' &&
      result.output.resumeAt > Date.now()
    );
  }

  /**
   * Handle delay node execution by pausing workflow and scheduling resume
   */
  private handleDelayNode(
    executionState: WorkflowExecutionState,
    delayNodeResult: NodeExecutionResult,
    currentNodeId: string,
    graph: Map<string, Graph>,
  ): WorkflowExecutionState {
    const resumeAt = delayNodeResult.output.resumeAt;

    // Store delay node result
    executionState.nodeResults.push(delayNodeResult);

    // Find next node after delay
    const outgoingEdges = graph.get(currentNodeId) || [];
    const nextNodeId = outgoingEdges[0]?.target || null;

    // Update execution state to waiting
    executionState.status = 'waiting';
    executionState.pausedAt = Date.now();
    executionState.resumeAt = resumeAt;
    executionState.nextNodeId = nextNodeId;

    this.logger.log(
      `Workflow ${
        executionState.workflowId
      } paused at node ${currentNodeId}, will resume at ${new Date(
        resumeAt,
      ).toISOString()}`,
    );

    return executionState;
  }

  private async executeNode(
    context: NcContext,
    node: WorkflowGeneralNode,
    expressionContext: ExpressionContext,
    testMode?: boolean,
    _nodeWrapper?: WorkflowNodeIntegration,
    nodes?: WorkflowGeneralNode[],
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

      if (node.type === GeneralNodeID.NOTE) {
        result.status = 'success';
        result.output = {};
        result.endTime = Date.now();
        return result;
      }

      const nodeWrapper =
        _nodeWrapper ||
        this.getNodeWrapper(context, node.type, node.data?.config || {});
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
        testMode,
      };

      const nodeResult: WorkflowNodeResult = await nodeWrapper.run(runContext);

      result.status = nodeResult.status || 'success';
      // Exclude testResult from stored input to prevent nested testResults
      const { testResult: _testResult, ...inputWithoutTestResult } =
        interpolatedData || {};
      result.input = inputWithoutTestResult;
      result.output = nodeResult.outputs;
      result.logs = nodeResult.logs;
      result.metrics = nodeResult.metrics;
      result.endTime = Date.now();
      result.loopContext = nodeResult.loopContext;

      // Generate variable definitions for input/output
      if (
        nodeWrapper &&
        typeof nodeWrapper.generateInputVariables === 'function'
      ) {
        try {
          result.inputVariables = await nodeWrapper.generateInputVariables(
            this.getVariableGeneratorContext(context, nodes),
            { config: interpolatedData, output: result.output },
          );
        } catch (error) {
          this.logger.warn(
            `Failed to generate input variables for ${node.id}:`,
            error,
          );
        }
      }

      if (
        nodeWrapper &&
        typeof nodeWrapper.generateOutputVariables === 'function'
      ) {
        try {
          result.outputVariables = await nodeWrapper.generateOutputVariables(
            this.getVariableGeneratorContext(context, nodes),
            { config: interpolatedData, output: result.output },
          );
        } catch (error) {
          this.logger.warn(
            `Failed to generate output variables for ${node.id}:`,
            error,
          );
        }
      } else if (result.output) {
        try {
          result.outputVariables = genGeneralVariables(result.output);
        } catch (error) {
          this.logger.warn(
            `Failed to auto-generate variables from output for ${node.id}:`,
            error,
          );
        }
      }

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
    onNodeExecuted?: (state: WorkflowExecutionState) => Promise<void>,
    resumeState?: WorkflowExecutionState,
    existingExecutionId?: string,
  ): Promise<WorkflowExecutionState> {
    const executionId =
      existingExecutionId ||
      `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const executionState: WorkflowExecutionState = resumeState || {
      id: executionId,
      workflowId: workflow.id,
      status: 'running',
      startTime: Date.now(),
      nodeResults: [],
      triggerData,
      triggerNodeTitle,
      loops: {},
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

      let currentNodeId = resumeState?.nextNodeId
        ? resumeState.nextNodeId
        : determineStartNode(nodes, triggerNodes, triggerNodeTitle, context);

      // Restore executed nodes from resume state if resuming
      const executedNodes = new Set<string>(
        resumeState?.nodeResults.map((r) => r.nodeId) || [],
      );
      const maxIterations = nodes.length * 1000;
      let iterations = 0;

      const activeLoops: ActiveLoop[] = [];

      while (currentNodeId && iterations < maxIterations) {
        iterations++;

        const node = nodeMap.get(currentNodeId);
        if (!node) {
          this.logger.error(`Node ${currentNodeId} not found in workflow`);
          break;
        }

        if (executedNodes.has(currentNodeId)) {
          this.logger.warn(`Cycle detected at node ${currentNodeId}`);
          break;
        }

        if (node.type === GeneralNodeID.PLUS) {
          const outgoingEdges = graph.get(currentNodeId) || [];
          if (outgoingEdges.length > 0) {
            // Plus node has outgoing edge, follow it
            currentNodeId = outgoingEdges[0].target;
            continue;
          } else if (activeLoops.length > 0) {
            // Plus node at end of loop body, trigger loop advancement
            const loop = activeLoops[activeLoops.length - 1];

            // We've completed one iteration, advance the loop state
            loop.state.currentIndex++;

            // Check if we should continue iterating
            const shouldContinue =
              loop.state.currentIndex < loop.state.totalItems;

            if (shouldContinue) {
              // Clear executed nodes for new iteration (except the iterate node itself)
              const iterateNodeId = loop.nodeId;
              executedNodes.clear();
              executedNodes.add(iterateNodeId);

              // More iterations to process, continue to body
              currentNodeId = loop.bodyStartNodeId;
              continue;
            } else {
              // All iterations processed, exit loop
              currentNodeId = loop.exitNodeId;

              // Clean up loop state
              activeLoops.pop();
              continue;
            }
          } else {
            // Plus node with no edges and no loop, end execution
            break;
          }
        }

        executedNodes.add(currentNodeId);
        executionState.currentNodeId = currentNodeId;

        // Create expression context
        const expressionContext = new ExpressionContext(
          executionState.nodeResults,
          nodes,
        );

        for (const loop of activeLoops) {
          // Inject variables namespaced by node title: $('Iterate').item
          const variables = {
            item: loop.state.items?.[loop.state.currentIndex],
            index: loop.state.currentIndex,
            itemCount: loop.state.totalItems,
          };
          expressionContext.setVariable(loop.nodeTitle, variables);
        }

        // Execute node
        const result = await this.executeNodeByType(
          context,
          node,
          triggerData,
          expressionContext,
          nodes,
        );

        // Check if node is a delay/pause node and should pause execution
        if (this.isDelayNode(node, result)) {
          return this.handleDelayNode(
            executionState,
            result,
            currentNodeId,
            graph,
          );
        }

        // Handle loop context
        if (result.loopContext && result.status === 'success') {
          const outgoingEdges = graph.get(currentNodeId) || [];
          const bodyEdge = outgoingEdges.find(
            (e) => e.sourcePortId === result.loopContext.bodyPort,
          );
          const exitEdge = outgoingEdges.find(
            (e) => e.sourcePortId === result.loopContext.exitPort,
          );

          activeLoops.push({
            nodeId: currentNodeId,
            nodeTitle: node.data?.title || currentNodeId,
            state: result.loopContext.state,
            bodyPort: result.loopContext.bodyPort,
            exitPort: result.loopContext.exitPort,
            bodyStartNodeId: bodyEdge?.target || null,
            exitNodeId: exitEdge?.target || null,
          });

          // Initialize loop tracking structure (nested if inside another loop)
          const loopData = {
            nodeId: currentNodeId,
            nodeTitle: node.data?.title || currentNodeId,
            totalIterations:
              result.loopContext.state.totalItems ||
              result.loopContext.state.items?.length ||
              0,
            iterations: {},
          };

          if (activeLoops.length === 1) {
            // Top-level loop - store at root
            if (!executionState.loops[currentNodeId]) {
              executionState.loops[currentNodeId] = loopData;
            }
          } else {
            // Nested loop - store in parent iteration's childLoops
            const parentLoop = activeLoops[activeLoops.length - 2];
            const parentLoopData = this.getLoopData(
              executionState,
              activeLoops.slice(0, -1),
            );
            const parentIteration =
              parentLoopData.iterations[parentLoop.state.currentIndex];

            if (!parentIteration.childLoops) {
              parentIteration.childLoops = {};
            }
            if (!parentIteration.childLoops[currentNodeId]) {
              parentIteration.childLoops[currentNodeId] = loopData;
            }
          }
        }

        // Store result in appropriate location (nested loop structure or main nodeResults)
        // Loop nodes themselves always go in nodeResults, only their children go in loops structure
        const isThisNodeALoopNode = !!result.loopContext;
        const isInsideALoop = activeLoops.length > 0 && !isThisNodeALoopNode;

        if (isInsideALoop) {
          // Inside a loop (but not the loop node itself) - store in nested structure
          const currentLoop = activeLoops[activeLoops.length - 1];
          const loopData = this.getLoopData(executionState, activeLoops);
          const iterationIndex = currentLoop.state.currentIndex;

          if (!loopData.iterations[iterationIndex]) {
            loopData.iterations[iterationIndex] = {
              iterationIndex,
              nodeResults: [],
            };
          }

          loopData.iterations[iterationIndex].nodeResults.push(result);
        } else {
          // Not in a loop OR this is the loop node itself - store in main nodeResults
          executionState.nodeResults.push(result);
        }

        if (onNodeExecuted) {
          try {
            await onNodeExecuted(executionState);
          } catch (error) {
            this.logger.error('Progress callback failed:', error);
          }
        }

        if (result.status === 'error') {
          executionState.status = 'error';
          executionState.endTime = Date.now();
          NcError.get(context).workflowNodeExecutionFailed(
            result.nodeTitle,
            result.error,
          );
        }

        // Stop execution if trigger node is skipped (e.g., filtered out)
        if (result.status === 'skipped') {
          executionState.status = 'skipped';
          executionState.endTime = Date.now();
          break;
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

      if (executionState.status === 'skipped') {
        return executionState;
      }

      // Mark execution as completed
      executionState.status = 'completed';
      executionState.endTime = Date.now();

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
    nodes?: WorkflowGeneralNode[],
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    // Handle trigger nodes
    if (isTriggerNode(node.type)) {
      return this.executeTriggerNode(
        context,
        node,
        triggerData,
        startTime,
        undefined,
        nodes,
      );
    }

    // Handle regular nodes
    return this.executeNode(
      context,
      node,
      expressionContext,
      undefined,
      undefined,
      nodes,
    );
  }

  private async executeTriggerNode(
    context: NcContext,
    node: WorkflowGeneralNode,
    triggerData: any,
    startTime: number,
    testMode?: boolean,
    nodes?: WorkflowGeneralNode[],
  ): Promise<NodeExecutionResult> {
    if (isTriggerNode(node.type)) {
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
          user: (triggerData as any)?.user || (context as any)?.user,
          testMode,
        };

        try {
          const nodeResult = await nodeWrapper.run(runContext);
          const result: NodeExecutionResult = {
            nodeId: node.id,
            nodeTitle: node.data?.title || 'Trigger',
            status: nodeResult.status || 'success',
            input: triggerData || {},
            output: nodeResult.outputs || {},
            startTime,
            endTime: Date.now(),
            logs: nodeResult.logs,
            metrics: nodeResult.metrics,
          };

          if (typeof nodeWrapper.generateInputVariables === 'function') {
            try {
              result.inputVariables = await nodeWrapper.generateInputVariables(
                this.getVariableGeneratorContext(context, nodes),
                { config: node.data?.config, output: nodeResult.outputs },
              );
            } catch (error) {
              this.logger.warn(
                `Failed to generate input variables for trigger ${node.id}:`,
                error,
              );
            }
          }

          if (typeof nodeWrapper.generateOutputVariables === 'function') {
            try {
              result.outputVariables =
                await nodeWrapper.generateOutputVariables(
                  this.getVariableGeneratorContext(context, nodes),
                  { config: node.data?.config, output: nodeResult.outputs },
                );
            } catch (error) {
              this.logger.warn(
                `Failed to generate output variables for trigger ${node.id}:`,
                error,
              );
            }
          } else if (result.output) {
            try {
              result.outputVariables = genGeneralVariables(result.output);
            } catch (error) {
              this.logger.warn(
                `Failed to auto-generate variables from trigger output for ${node.id}:`,
                error,
              );
            }
          }

          return result;
        } catch (error) {
          this.logger.error(`Trigger node failed: ${node.id}`, error);
          return {
            nodeId: node.id,
            nodeTitle: node.data?.title || 'Trigger',
            status: 'error',
            error: error.message || 'Trigger execution failed',
            input: triggerData || {},
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
      input: triggerData || {},
      output: triggerData || {},
      startTime,
      endTime: Date.now(),
    };
  }

  /**
   * Test execute a single node by reusing test results from previous nodes
   * This builds the execution context from stored test data
   */
  async testExecuteNode(
    context: NcContext,
    workflow: WorkflowType,
    targetNodeId: string,
    testTriggerData?: any,
  ): Promise<NodeExecutionResult> {
    // ALWAYS PRIORITIZE DRAFT NODES WHEN TESTING
    const nodes = ((workflow as any).draft?.nodes ||
      workflow.nodes ||
      []) as WorkflowGeneralNode[];
    const edges = ((workflow as any).draft?.edges ||
      workflow.edges ||
      []) as WorkflowGeneralEdge[];

    const nodeMap = new Map<string, WorkflowGeneralNode>(
      nodes.map((n) => [n.id, n]),
    );

    const targetNode = nodeMap.get(targetNodeId);
    if (!targetNode) {
      NcError.get(context).workflowNodeNotFound(targetNodeId);
    }

    // Validate node configuration before testing
    const nodeWrapper = this.getNodeWrapper(
      context,
      targetNode.type,
      targetNode.data?.config || {},
    );

    if (nodeWrapper) {
      try {
        const validationResult = await nodeWrapper.validate(nodeWrapper.config);

        if (!validationResult.valid && validationResult.errors) {
          const errorMessages = validationResult.errors
            .map((e) => e.message)
            .join(', ');
          NcError.get(context).badRequest(errorMessages);
        }
      } catch (error) {
        this.logger.error(`Node validation error: ${targetNode.id}`, error);
        if (error instanceof NcError || error instanceof NcBaseError)
          throw error;
        NcError.get(context).badRequest(
          `Node validation failed: ${error.message}`,
        );
      }
    }

    const { reverseGraph, triggerNodes } = buildWorkflowGraph(nodes, edges);

    const isTriggerNode =
      targetNode.type === GeneralNodeID.TRIGGER ||
      targetNode.type?.startsWith('nocodb.trigger.') ||
      targetNode.type?.startsWith('core.trigger.') ||
      triggerNodes.some((t) => t.id === targetNodeId);

    if (isTriggerNode) {
      const result = await this.executeTriggerNode(
        context,
        targetNode,
        testTriggerData || {},
        Date.now(),
        true,
        nodes,
      );

      let inputVariables: VariableDefinition[] = [];
      let outputVariables: VariableDefinition[] = [];

      if (nodeWrapper) {
        if (typeof nodeWrapper.generateInputVariables === 'function') {
          try {
            inputVariables = await nodeWrapper.generateInputVariables(
              this.getVariableGeneratorContext(context, nodes),
              { config: targetNode.data?.config, output: result.output },
            );
          } catch (error) {
            this.logger.warn(
              `Failed to generate input variables for trigger ${targetNodeId}:`,
              error,
            );
          }
        }

        if (typeof nodeWrapper.generateOutputVariables === 'function') {
          try {
            outputVariables = await nodeWrapper.generateOutputVariables(
              this.getVariableGeneratorContext(context, nodes),
              { config: targetNode.data?.config, output: result.output },
            );
          } catch (error) {
            this.logger.warn(
              `Failed to generate output variables for trigger ${targetNodeId}:`,
              error,
            );
          }
        } else if (result.output) {
          try {
            outputVariables = genGeneralVariables(result.output);
          } catch (error) {
            this.logger.warn(
              `Failed to auto-generate variables from trigger output for ${targetNodeId}:`,
              error,
            );
          }
        }
      }

      return {
        ...result,
        inputVariables,
        outputVariables,
      };
    }

    // For non-trigger nodes, build context from stored test results
    const parentNodes = findParentNodes(targetNodeId, reverseGraph, nodes);

    // Check if all parent nodes have test results
    const missingTestResults = parentNodes.filter(
      (node) => !node.data?.testResult,
    );

    if (missingTestResults.length > 0) {
      const missingTitles = missingTestResults
        .map((n) => n.data?.title || n.id)
        .join(', ');
      NcError.get(context).badRequest(
        `Please test the following nodes first: ${missingTitles}`,
      );
    }

    const nodeResults: NodeExecutionResult[] = [];
    for (const parentNode of parentNodes) {
      if (parentNode.data?.testResult) {
        nodeResults.push(parentNode.data.testResult);
      }
    }

    const expressionContext = new ExpressionContext(nodeResults, nodes, true);

    // Check if target node is inside a loop and inject mock loop variables
    const loopContext = findParentLoops(targetNodeId, reverseGraph, nodeMap);

    for (const loopInfo of loopContext) {
      const loopNode = nodeMap.get(loopInfo.loopNodeId);
      const loopTestResult = loopNode?.data?.testResult;

      if (!loopTestResult) {
        NcError.get(context).badRequest(
          `Please test "${
            loopNode?.data?.title || 'loop'
          }" node first before testing nodes inside it`,
        );
      }

      // Inject mock loop variables for first iteration (index 0)
      const loopItems = loopTestResult.output?.items || [];

      const mockLoopVariables = {
        item: loopItems[0],
        index: 0,
        itemCount: loopTestResult.output?.itemCount || loopItems.length,
      };

      expressionContext.setVariable(
        loopNode?.data?.title || loopInfo.loopNodeId,
        mockLoopVariables,
      );
    }

    const result = await this.executeNode(
      context,
      targetNode,
      expressionContext,
      true,
      nodeWrapper,
      nodes,
    );

    // Add note if tested with mock loop variables
    if (loopContext.length > 0) {
      if (!result.logs) result.logs = [];
      result.logs.unshift({
        level: 'info',
        message: `Tested with mock loop variables (iteration 0)`,
        ts: Date.now(),
      });
    }

    let inputVariables: VariableDefinition[] = [];
    if (
      nodeWrapper &&
      typeof nodeWrapper.generateInputVariables === 'function'
    ) {
      try {
        inputVariables = await nodeWrapper.generateInputVariables(
          this.getVariableGeneratorContext(context, nodes),
          { config: targetNode.data?.config, output: result.output },
        );
      } catch (error) {
        this.logger.warn(
          `Failed to generate input variables for ${targetNodeId}:`,
          error,
        );
      }
    }

    let outputVariables: VariableDefinition[] = [];
    if (
      nodeWrapper &&
      typeof nodeWrapper.generateOutputVariables === 'function'
    ) {
      try {
        outputVariables = await nodeWrapper.generateOutputVariables(
          this.getVariableGeneratorContext(context, nodes),
          { config: targetNode.data?.config, output: result.output },
        );
      } catch (error) {
        this.logger.warn(
          `Failed to generate output variables for ${targetNodeId}:`,
          error,
        );
      }
    } else if (result.output) {
      try {
        outputVariables = genGeneralVariables(result.output);
      } catch (error) {
        this.logger.warn(
          `Failed to auto-generate variables from output for ${targetNodeId}:`,
          error,
        );
      }
    }

    return {
      ...result,
      inputVariables,
      outputVariables,
    };
  }
}
