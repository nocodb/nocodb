/**
 * Agent sections — collapsible folders in the Agents sidebar that group a
 * base's agents.
 */
export interface AgentSectionType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  title: string;
  order?: number;
  meta?: Record<string, any>;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AgentSectionListType {
  list: AgentSectionType[];
}

export interface AgentSectionCreateReqType {
  title: string;
  order?: number;
  meta?: Record<string, any>;
}

export interface AgentSectionUpdateReqType {
  title?: string;
  order?: number;
  meta?: Record<string, any>;
}
