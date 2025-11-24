enum VariableType {
  String = 'string',
  Number = 'number',
  Integer = 'integer',
  Boolean = 'boolean',
  Object = 'object',
  Array = 'array',
  DateTime = 'datetime',
}

enum VariableGroupKey {
  Meta = 'meta', // System fields (id, createdAt, etc.)
  Fields = 'fields', // User data fields
}

interface VariableDefinition {
  // Expression reference (e.g., "fields.Title" for use in {{ $("Node").fields.Title }})
  key: string;

  // Human-readable name for UI (e.g., "Title")
  name: string;

  // Variable type
  type: VariableType;

  // UI grouping
  groupKey?: VariableGroupKey;

  // Is this variable an array?
  isArray?: boolean;

  // Additional metadata for UI
  extra?: {
    // Column ID for fields
    columnId?: string;

    // icon for the variable
    icon?: string;

    // UIType for fields
    uiType?: string;

    // Table/View names for display
    tableName?: string;
    viewName?: string;

    // Description for tooltips
    description?: string;
  };

  // Nested variables for objects/arrays
  children?: VariableDefinition[];
}

interface NodeExecutionResult {
  nodeId: string;
  nodeTitle: string;
  status: 'pending' | 'running' | 'success' | 'error';
  output?: any;
  input?: any;
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
  isStale?: boolean;
  inputVariables?: VariableDefinition[];
  outputVariables?: VariableDefinition[];
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
    testResult?: NodeExecutionResult;
    inputVariables?: VariableDefinition[];
    outputVariables?: VariableDefinition[];
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
  VariableType,
  VariableGroupKey,
  VariableDefinition,
  WorkflowGeneralEdge,
  WorkflowGeneralNode,
  NodeExecutionResult,
  WorkflowExecutionState,
};
