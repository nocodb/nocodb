enum VariableType {
  String = 'string',
  Number = 'number',
  Integer = 'integer',
  Boolean = 'boolean',
  Object = 'object',
  Array = 'array',
  Date = 'date',
  DateTime = 'datetime',
}

enum VariableGroupKey {
  Meta = 'meta', // System fields (id, createdAt, etc.)
  Fields = 'fields', // User data fields
  Iteration = 'iteration', // Iteration variables (item, index for loops)
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
    // Entity ID for dependency tracking
    entity_id?: string;

    // Entity type for dependency tracking ('column' | 'table' | 'view')
    entity?: 'column' | 'table' | 'view';

    // icon for the variable
    icon?: string;

    // UIType for fields
    uiType?: string;

    // Table/View names for display
    tableName?: string;
    viewName?: string;

    // Description for tooltips
    description?: string;

    // Value for dynamically generated variables (used in data display)
    value?: any;

    // Item schema for array variables - defines the structure of each array item
    // Used to generate "Record 1", "Record 2", etc. when displaying actual data
    itemSchema?: VariableDefinition[];

    // Entity references for dependency tracking
    // When a variable is an array of objects, this property is used to track the entities that are referenced by the objects
    entityReferences?: {
      entity_id: string;
      entity: 'column' | 'table' | 'view';
      title: string;
      field: string;
    }[];

    // Port identifier for multi-port nodes (e.g., 'body', 'output' for iterate node)
    // Used to filter variables based on which port is being accessed
    port?: string;
  };

  // Nested variables for objects/arrays
  children?: VariableDefinition[];
}

interface NodeExecutionResult {
  testMode?: string;
  nodeId: string;
  nodeTitle: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
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

  // Loop context: Returned by loop nodes to control iteration
  loopContext?: LoopContext;
}

// Loop context for loop nodes (iterate, etc.)
interface LoopContext {
  // Serializable state that persists across iterations
  state: Record<string, any>;

  // Output port IDs
  bodyPort: string; // Port for loop body (e.g., 'body' for 'For Each Item')
  exitPort: string; // Port for loop exit (e.g., 'output' for 'After Iterate')
}

// Loop iteration structure (recursive for nested loops)
interface LoopIteration {
  iterationIndex: number;
  nodeResults: NodeExecutionResult[];
  childLoops?: {
    [loopNodeId: string]: LoopData;
  };
}

// Loop data structure
interface LoopData {
  nodeId: string;
  nodeTitle: string;
  totalIterations: number;
  iterations: {
    [iterationIndex: number]: LoopIteration;
  };
}

interface WorkflowExecutionState {
  id: string;
  workflowId: string;
  status:
    | 'running'
    | 'waiting'
    | 'completed'
    | 'error'
    | 'cancelled'
    | 'skipped';
  startTime: number;
  endTime?: number;
  nodeResults: NodeExecutionResult[];
  currentNodeId?: string;
  triggerData?: any;
  triggerNodeTitle?: string; // Optional: which trigger node to start from
  loops?: {
    [loopNodeId: string]: LoopData;
  };

  // Delay/pause support
  pausedAt?: number; // When workflow was paused
  resumeAt?: number; // When to resume (timestamp from delay node)
  nextNodeId?: string; // Which node to execute after resume
}

interface IWorkflowExecution {
  id: string;

  fk_workspace_id: string;
  base_id: string;

  fk_workflow_id: string;

  workflow_data?:
    | {
        id: string;
        title: string;
        nodes: WorkflowGeneralNode[];
        edges: WorkflowGeneralEdge[];
      }
    | Record<string, any>;

  execution_data?: WorkflowExecutionState;

  created_at?: string;
  updated_at?: string;

  finished_at?: string;
  started_at?: string;
  finished?: boolean;

  status:
    | 'running'
    | 'waiting'
    | 'completed'
    | 'error'
    | 'cancelled'
    | 'skipped';

  // When to resume if paused
  resume_at?: string | Date;
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
    description?: string;
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
  label?: string; // Optional label for display (e.g., "True", "For Each Item")
  sourcePortId?: string; // Source node's output port ID for routing
  targetPortId?: string; // Target node's input port ID
}

export {
  VariableType,
  VariableGroupKey,
  VariableDefinition,
  WorkflowGeneralEdge,
  WorkflowGeneralNode,
  NodeExecutionResult,
  WorkflowExecutionState,
  IWorkflowExecution,
  LoopContext,
  LoopIteration,
  LoopData,
};
