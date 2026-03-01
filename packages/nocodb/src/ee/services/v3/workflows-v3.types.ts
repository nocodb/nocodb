import type { WorkflowGeneralEdge, WorkflowGeneralNode } from 'nocodb-sdk';

export type WorkflowV3ListItemType = {
  id: string;
  title: string;
  description: string;
  base_id: string;
  workspace_id: string;
  enabled: boolean;
  order: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
};

export type WorkflowV3ListResponseType = {
  list: WorkflowV3ListItemType[];
};

export type WorkflowV3GetResponseType = {
  id: string;
  title: string;
  description: string;
  base_id: string;
  workspace_id: string;
  enabled: boolean;
  nodes: WorkflowGeneralNode[];
  edges: WorkflowGeneralEdge[];
  draft: Record<string, unknown>;
  meta: Record<string, unknown>;
  order: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
};

export type WorkflowV3CreateReqType = {
  title: string;
  description?: string;
  nodes?: WorkflowGeneralNode[];
  edges?: WorkflowGeneralEdge[];
  meta?: Record<string, unknown>;
};

export type WorkflowV3UpdateReqType = {
  title?: string;
  description?: string;
  enabled?: boolean;
  nodes?: WorkflowGeneralNode[];
  edges?: WorkflowGeneralEdge[];
  draft?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  order?: number;
};

export type WorkflowV3ExecuteReqType = {
  trigger_data?: Record<string, unknown>;
};

export type WorkflowV3TestNodeReqType = {
  node_id: string;
  test_trigger_data?: Record<string, unknown>;
  test_mode?: 'sample_data' | 'listen_webhook' | 'trigger_event';
};

export type WorkflowExecutionV3ListItemType = {
  id: string;
  workflow_id: string;
  status: string;
  started_at: string;
  finished_at: string;
  created_at: string;
};

export type WorkflowExecutionV3ListResponseType = {
  list: WorkflowExecutionV3ListItemType[];
};

export type WorkflowExecutionV3GetResponseType = {
  id: string;
  workflow_id: string;
  status: string;
  execution_data: Record<string, unknown>;
  started_at: string;
  finished_at: string;
  created_at: string;
};
