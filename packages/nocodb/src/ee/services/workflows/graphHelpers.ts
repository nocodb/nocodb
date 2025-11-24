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
      edgeId: edge.id || edgeKey,
    });

    reverseGraph.get(edge.target)!.push({
      source: edge.source,
      label: edge.label,
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
  triggerNodeTitle: string | undefined,
  context: NcContext,
): string {
  if (triggerNodeTitle) {
    const triggerNode = nodes.find(
      (n) =>
        n.data?.title === triggerNodeTitle || n.type === GeneralNodeID.TRIGGER,
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

  // 4. Conditional flow: Multiple outgoing edges - use node-specific logic
  return resolveConditionalBranch(
    currentNode,
    currentResult,
    outgoingEdges,
    logger,
  );
}

// NEW: Extract conditional branching logic
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

  if (nodeType === 'core.flow.if') {
    return resolveIfNodeBranch(currentResult, outgoingEdges, logger);
  }

  // Unknown branching node - log warning and take first edge
  logger?.warn(
    `Node type "${nodeType}" has multiple edges but no branching logic defined, taking first edge`,
  );
  return outgoingEdges[0]?.target || null;
}

// NEW: Extract if-node branch resolution
function resolveIfNodeBranch(
  result: NodeExecutionResult,
  outgoingEdges: Graph,
  logger?: { debug: (msg: string) => void; warn: (msg: string) => void },
): string | null {
  const conditionResult = result.output?.result;

  // Handle boolean result
  if (typeof conditionResult === 'boolean') {
    const targetLabel = conditionResult ? 'true' : 'false';
    const matchingEdge = outgoingEdges.find(
      (edge) => edge.label?.toLowerCase() === targetLabel,
    );

    if (matchingEdge) {
      logger?.debug(
        `If condition evaluated to ${conditionResult}, taking "${targetLabel}" branch`,
      );
      return matchingEdge.target;
    }

    logger?.warn(
      `No edge found with label "${targetLabel}", looking for default branch`,
    );
  } else {
    logger?.warn(
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
    logger?.debug('Taking fallback branch: default/false');
    return fallbackEdge.target;
  }

  // Last resort: take first edge
  logger?.warn('No matching branch found, taking first edge');
  return outgoingEdges[0]?.target || null;
}

function findParentNodes(
  nodeId: string,
  reverseGraph: Map<
    string,
    Array<{ source?: string; label?: string; edgeId: string }>
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

export { buildWorkflowGraph, determineStartNode, getNextNode, findParentNodes };
