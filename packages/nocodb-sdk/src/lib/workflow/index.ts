import type { Node, Edge } from '@vue-flow/core';
import { WorkflowType } from '../Api';

/**
 * Workflow Categories
 * Used to organize different types of workflow nodes
 */
export enum WorkflowCategory {
  TRIGGER = 'trigger',
  ACTION = 'action',
  LOGIC = 'logic',
  CONTROL = 'control',
}

/**
 * Workflow Status
 */
export enum WorkflowStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft',
  ERROR = 'error',
}

/**
 * Workflow Node Types
 * Defines all available node types in the system
 */
export enum WorkflowNodeTypeEnum {
  // Core
  TRIGGER = 'core.trigger',
  PLUS = 'core.plus',

  // Triggers
  TRIGGER_MANUAL = 'trigger.manual',
  TRIGGER_WEBHOOK = 'trigger.webhook',
  TRIGGER_SCHEDULE = 'trigger.schedule',
  TRIGGER_RECORD_CREATED = 'trigger.record.created',
  TRIGGER_RECORD_UPDATED = 'trigger.record.updated',
  TRIGGER_RECORD_DELETED = 'trigger.record.deleted',

  // NocoDB Actions
  NOCODB_CREATE_RECORD = 'nocodb.create_record',
  NOCODB_UPDATE_RECORD = 'nocodb.update_record',
  NOCODB_DELETE_RECORD = 'nocodb.delete_record',
  NOCODB_FIND_RECORD = 'nocodb.find_record',
  NOCODB_LIST_RECORDS = 'nocodb.list_records',

  // Communication
  SEND_EMAIL = 'nocodb.send_email',
  SEND_SLACK_MESSAGE = 'nocodb.send_slack',
  SEND_WEBHOOK = 'nocodb.send_webhook',

  // Logic & Control Flow
  IF_CONDITION = 'core.if_condition',
  SWITCH = 'core.switch',
  LOOP = 'core.loop',
  DELAY = 'core.delay',
  MERGE = 'core.merge',

  // Data Transformation
  TRANSFORM_DATA = 'core.transform',
  FILTER_DATA = 'core.filter',
  AGGREGATE_DATA = 'core.aggregate',
}

/**
 * Workflow Node Type Definition
 * Metadata about each type of node that can be used in a workflow
 */
export interface WorkflowNodeType {
  /** Unique type identifier */
  type: WorkflowNodeTypeEnum | string;

  /** Display name */
  label: string;

  /** Icon identifier */
  icon: string;

  /** Category for grouping */
  category: WorkflowCategory;

  /** Number of input handles (default: 1) */
  inputs?: number;

  /** Number of output handles (default: 1) */
  outputs?: number;

  /** Description of what this node does */
  description?: string;

  /** Whether this node type is hidden from the UI */
  hidden?: boolean;

  /** Color for the node (optional) */
  color?: string;

  /** Whether this node can be deleted */
  deletable?: boolean;

  /** Whether this node can be duplicated */
  duplicable?: boolean;
}

/**
 * Workflow Node Position
 */
export interface WorkflowNodePosition {
  x: number;
  y: number;
}

/**
 * Workflow Node Handle Position
 */
export type WorkflowHandlePosition = 'top' | 'right' | 'bottom' | 'left';

/**
 * Workflow Node Data
 * Custom data stored within each node
 */
export interface WorkflowNodeData {
  /** Node type metadata */
  type?: string;

  /** Display label */
  label?: string;

  /** Node configuration/settings */
  config?: Record<string, any>;

  /** Input parameters */
  inputs?: Record<string, any>;

  /** Output data structure */
  outputs?: Record<string, any>;

  /** Validation errors */
  errors?: string[];

  /** Whether the node is disabled */
  disabled?: boolean;

  /** Node notes/comments */
  notes?: string;

  /** Execution statistics */
  stats?: {
    lastExecutedAt?: string;
    executionCount?: number;
    successCount?: number;
    errorCount?: number;
  };
}

/**
 * Workflow Node
 * Extends VueFlow Node with our custom data
 */
export interface WorkflowNode extends Omit<Node, 'data' | 'type'> {
  /** Node ID (UUID) */
  id: string;

  /** Node type */
  type: WorkflowNodeTypeEnum | string;

  /** Position on canvas */
  position: WorkflowNodePosition;

  /** Custom node data */
  data: WorkflowNodeData;
}

/**
 * Workflow Edge Type
 */
export enum WorkflowEdgeType {
  DEFAULT = 'default',
  STEP = 'step',
  SMOOTH_STEP = 'smoothstep',
  STRAIGHT = 'straight',
  BEZIER = 'bezier',
}

/**
 * Workflow Edge Data
 */
export interface WorkflowEdgeData {
  /** Edge label */
  label?: string;

  /** Condition for conditional edges */
  condition?: string;

  /** Branch name (for if/else, switch) */
  branch?: string;

  /** Whether edge is active */
  active?: boolean;

  /** Edge color */
  color?: string;

  /** Custom data */
  [key: string]: any;
}

/**
 * Workflow Edge
 * Extends VueFlow Edge with our custom data
 */
export interface WorkflowEdge extends Omit<Edge, 'data'> {
  /** Edge ID */
  id: string;

  /** Source node ID */
  source: string;

  /** Target node ID */
  target: string;

  /** Custom edge data */
  data?: WorkflowEdgeData;
}

/**
 * Workflow Metadata
 * Additional metadata about the workflow
 */
export interface WorkflowMeta {
  /** Workflow version */
  version?: string;

  /** Last edited by user ID */
  lastEditedBy?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Workflow description */
  description?: string;

  /** Canvas viewport state */
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };

  /** Variables defined in the workflow */
  variables?: Record<string, any>;

  /** Workflow settings */
  settings?: {
    /** Max concurrent executions */
    maxConcurrency?: number;

    /** Timeout in seconds */
    timeout?: number;

    /** Error handling strategy */
    errorHandling?: 'stop' | 'continue' | 'retry';

    /** Number of retries */
    retries?: number;

    /** Retry delay in seconds */
    retryDelay?: number;
  };

  /** Custom metadata */
  [key: string]: any;
}

/**
 * Workflow Execution Status
 */
export enum WorkflowExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  ERROR = 'error',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

/**
 * Workflow Execution Log Entry
 */
export interface WorkflowExecutionLog {
  /** Log entry ID */
  id?: string;

  /** Workflow ID */
  workflow_id?: string;

  /** Execution ID */
  execution_id?: string;

  /** Node ID that generated this log */
  node_id?: string;

  /** Log level */
  level?: 'info' | 'warn' | 'error' | 'debug';

  /** Log message */
  message?: string;

  /** Additional data */
  data?: Record<string, any>;

  /** Timestamp */
  timestamp?: string;
}

/**
 * Workflow Execution
 * Represents a single execution instance of a workflow
 */
export interface WorkflowExecution {
  /** Execution ID */
  id?: string;

  /** Workflow ID */
  workflow_id?: string;

  /** Execution status */
  status?: WorkflowExecutionStatus;

  /** Trigger data */
  trigger_data?: Record<string, any>;

  /** Start time */
  started_at?: string;

  /** Finish time */
  finished_at?: string;

  /** Duration in milliseconds */
  duration?: number;

  /** Error message if failed */
  error?: string;

  /** Execution logs */
  logs?: WorkflowExecutionLog[];

  /** Node execution results */
  node_results?: Record<string, any>;

  /** Created by user ID */
  created_by?: string;

  /** Created timestamp */
  created_at?: string;
}

/**
 * Workflow Trigger Configuration
 */
export interface WorkflowTriggerConfig {
  /** Trigger type */
  type: WorkflowNodeTypeEnum | string;

  /** Trigger-specific configuration */
  config?: Record<string, any>;

  /** Schedule configuration (for scheduled triggers) */
  schedule?: {
    /** Cron expression */
    cron?: string;

    /** Timezone */
    timezone?: string;
  };

  /** Webhook configuration */
  webhook?: {
    /** Webhook URL */
    url?: string;

    /** HTTP method */
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

    /** Authentication required */
    auth?: boolean;
  };

  /** Table trigger configuration */
  table?: {
    /** Table ID */
    table_id?: string;

    /** Trigger on create */
    onCreate?: boolean;

    /** Trigger on update */
    onUpdate?: boolean;

    /** Trigger on delete */
    onDelete?: boolean;

    /** Filter conditions */
    filter?: Record<string, any>;
  };
}

/**
 * Workflow List Response
 */
export interface WorkflowListType {
  /** List of workflows */
  list?: WorkflowType[];

  /** Page info for pagination */
  pageInfo?: {
    totalRows?: number;
    page?: number;
    pageSize?: number;
    isFirstPage?: boolean;
    isLastPage?: boolean;
  };
}

/**
 * Workflow Node Input/Output Schema
 */
export interface WorkflowNodeIOSchema {
  /** Field name */
  name: string;

  /** Field label */
  label: string;

  /** Field type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'file';

  /** Field description */
  description?: string;

  /** Whether field is required */
  required?: boolean;

  /** Default value */
  default?: any;

  /** Validation rules */
  validation?: Record<string, any>;

  /** Nested schema for objects/arrays */
  schema?: WorkflowNodeIOSchema[];
}

