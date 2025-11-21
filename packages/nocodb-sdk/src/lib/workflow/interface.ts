interface NodeExecutionResult {
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

interface WorkflowExecutionState {
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

interface NodeConfig {
  [key: string]: any;
}

interface WorkflowGeneralNode {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    config: NodeConfig;
    title: string;
  };
  targetPosition: 'top' | 'bottom' | 'left' | 'right';
  sourcePosition: 'top' | 'bottom' | 'left' | 'right';
}

interface WorkflowGeneralEdge {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
  animated: boolean;
  label?: string; // Optional label like "True" or "False"
}

export {
  WorkflowGeneralEdge,
  WorkflowGeneralNode,
  NodeExecutionResult,
  WorkflowExecutionState,
};
