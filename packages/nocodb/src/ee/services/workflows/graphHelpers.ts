import { GeneralNodeID } from 'nocodb-sdk';
import type {
  NcContext,
  NodeExecutionResult,
  WorkflowGeneralEdge,
  WorkflowGeneralNode,
} from 'nocodb-sdk';
import { NcError } from '~/helpers/ncError';

type Graph = Array<{
  label?: string;
  sourcePortId?: string; // Port ID from source node
  edgeId: string;
  target?: string;
  source?: string;
}>;

function buildWorkflowGraph(
  nodes: WorkflowGeneralNode[],
  edges: WorkflowGeneralEdge[],
) {
  const graph = new Map<string, Graph>();
  const reverseGraph = new Map<string, Graph>();
  const inDegree = new Map<string, number>();

  // Track seen edges to handle duplicates
  const seenEdges = new Set<string>();

  // Initialize all nodes
  nodes.forEach((node) => {
    graph.set(node.id, []);
    reverseGraph.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  // Build edges with validation
  edges.forEach((edge) => {
    // Validate edge references exist
    if (!graph.has(edge.source)) {
      console.warn(`Edge source not found: ${edge.source}`);
      return;
    }

    if (!graph.has(edge.target)) {
      console.warn(`Edge target not found: ${edge.target}`);
      return;
    }

    // Handle duplicate edges - create unique key
    const edgeKey = `${edge.source}->${edge.target}${
      edge.label ? `:${edge.label}` : ''
    }`;
    if (seenEdges.has(edgeKey)) {
      console.warn(`Duplicate edge detected: ${edgeKey}`);
      return;
    }
    seenEdges.add(edgeKey);

    // Add to graph structures
    graph.get(edge.source)!.push({
      target: edge.target,
      label: edge.label,
      sourcePortId: edge.sourcePortId,
      edgeId: edge.id || edgeKey,
    });

    reverseGraph.get(edge.target)!.push({
      source: edge.source,
      label: edge.label,
      sourcePortId: edge.sourcePortId,
      edgeId: edge.id || edgeKey,
    });

    inDegree.set(edge.target, inDegree.get(edge.target)! + 1);
  });

  // Find trigger nodes (nodes with no incoming edges)
  const triggerNodes = nodes.filter(
    (node) => inDegree.get(node.id) === 0,
  ) as WorkflowGeneralNode[];

  return { graph, reverseGraph, inDegree, triggerNodes };
}

function determineStartNode(
  nodes: WorkflowGeneralNode[],
  triggerNodes: WorkflowGeneralNode[],
  triggerNodeTitleOrTriggerId: string | undefined,
  context: NcContext,
): string {
  if (triggerNodeTitleOrTriggerId) {
    const triggerNode = nodes.find(
      (n) =>
        n.data?.title === triggerNodeTitleOrTriggerId ||
        n.type === GeneralNodeID.TRIGGER ||
        n.id === triggerNodeTitleOrTriggerId,
    );
    if (!triggerNode) {
      NcError.get(context).workflowTriggerNodeNotFound();
    }
    return triggerNode.id;
  }

  if (triggerNodes.length > 0) {
    return triggerNodes[0].id;
  }

  return nodes[0].id;
}

function getNextNode(
  currentNodeId: string,
  currentResult: NodeExecutionResult,
  graph: Map<string, Graph>,
  nodes: WorkflowGeneralNode[],
  nodeMap: Map<string, WorkflowGeneralNode>,
  logger?: { debug: (msg: string) => void; warn: (msg: string) => void },
): string | null {
  const currentNode = nodeMap.get(currentNodeId);
  const outgoingEdges = graph.get(currentNodeId) || [];

  // 1. Explicit routing: Node explicitly specifies next node by title
  if (currentResult.nextNode) {
    const nextNode = nodes.find(
      (n) => n.data?.title === currentResult.nextNode,
    );
    if (nextNode) {
      logger?.debug(
        `Routing to explicitly specified node: "${currentResult.nextNode}"`,
      );
      return nextNode.id;
    }
    logger?.warn(
      `Next node "${currentResult.nextNode}" not found, falling back to edge-based routing`,
    );
  }

  // 2. End of flow: No outgoing edges
  if (outgoingEdges.length === 0) {
    logger?.debug('No outgoing edges, ending workflow');
    return null;
  }

  // 3. Linear flow: Single outgoing edge
  if (outgoingEdges.length === 1) {
    return outgoingEdges[0].target;
  }

  // 4. Conditional flow: Multiple outgoing edges
  return resolveConditionalBranch(
    currentNode,
    currentResult,
    outgoingEdges,
    logger,
  );
}

/**
 * Generic conditional branching logic using port-based routing
 *
 * This function provides a universal way to handle branching nodes:
 * 1. If node returns `output.port`, match it to edge label (case-insensitive)
 * 2. Fallback to first edge if no match found
 *
 * @param currentNode - The node being executed
 * @param currentResult - The execution result from the node
 * @param outgoingEdges - Available outgoing edges
 * @param logger - Optional logger for debugging
 * @returns Next node ID or null to end workflow
 */
function resolveConditionalBranch(
  currentNode: WorkflowGeneralNode,
  currentResult: NodeExecutionResult,
  outgoingEdges: Graph,
  logger?: { debug: (msg: string) => void; warn: (msg: string) => void },
): string | null {
  const nodeType = currentNode?.type;

  if (!nodeType) {
    logger?.warn(`Node ${currentNode?.id} has no type, taking first edge`);
    return outgoingEdges[0].target;
  }

  // If the node returns a 'port' field in its output, match it to edge sourcePortId
  if (currentResult.output?.port) {
    const port = currentResult.output.port;

    const matchingEdge = outgoingEdges.find(
      (edge) => edge.sourcePortId?.toLowerCase() === String(port).toLowerCase(),
    );

    if (matchingEdge) {
      logger?.debug(`Port-based routing: "${port}" -> ${matchingEdge.target}`);
      return matchingEdge.target;
    }

    logger?.warn(
      `Port "${port}" specified but no matching edge found with sourcePortId`,
    );
  }

  logger?.warn(
    `Node type "${nodeType}" has multiple edges but no port specified, taking first edge`,
  );
  return outgoingEdges[0]?.target || null;
}

function findParentNodes(
  nodeId: string,
  reverseGraph: Map<
    string,
    Array<{
      source?: string;
      label?: string;
      sourcePortId?: string;
      edgeId: string;
    }>
  >,
  allNodes: WorkflowGeneralNode[],
): WorkflowGeneralNode[] {
  const visited = new Set<string>();
  const orderedParents: WorkflowGeneralNode[] = [];
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  const dfs = (currentId: string) => {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const parents = reverseGraph.get(currentId) || [];

    // Visit parents first (DFS)
    for (const parent of parents) {
      if (parent.source) {
        dfs(parent.source);
      }
    }

    // Add current node after visiting parents
    const node = nodeMap.get(currentId);
    if (node) {
      orderedParents.push(node);
    }
  };

  // Start DFS from target node's parents
  const directParents = reverseGraph.get(nodeId) || [];
  for (const parent of directParents) {
    if (parent.source) {
      dfs(parent.source);
    }
  }

  return orderedParents;
}

/**
 * Find parent loop nodes for a given target node
 * Returns array of loop info (supports nested loops)
 */
function findParentLoops(
  targetNodeId: string,
  reverseGraph: Map<
    string,
    Array<{
      source?: string;
      label?: string;
      sourcePortId?: string;
      edgeId: string;
    }>
  >,
  nodeMap: Map<string, WorkflowGeneralNode>,
): Array<{ loopNodeId: string; bodyPort: string }> {
  const loops: Array<{ loopNodeId: string; bodyPort: string }> = [];
  const visited = new Set<string>();

  const queue = [targetNodeId];
  visited.add(targetNodeId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const incomingEdges = reverseGraph.get(currentId) || [];

    for (const edge of incomingEdges) {
      if (!edge.source) continue;

      const sourceNode = nodeMap.get(edge.source);

      // Check if source is a loop node with body port
      if (sourceNode?.data?.testResult?.loopContext) {
        const loopContext = sourceNode.data.testResult.loopContext;
        // Check if this edge is from the loop's body port
        if (edge.sourcePortId === loopContext.bodyPort) {
          loops.push({
            loopNodeId: edge.source,
            bodyPort: loopContext.bodyPort,
          });
        }
      }

      // Continue traversal
      if (!visited.has(edge.source)) {
        visited.add(edge.source);
        queue.push(edge.source);
      }
    }
  }

  // Return loops in order from outermost to innermost
  return loops.reverse();
}

export {
  buildWorkflowGraph,
  determineStartNode,
  getNextNode,
  findParentNodes,
  findParentLoops,
};
