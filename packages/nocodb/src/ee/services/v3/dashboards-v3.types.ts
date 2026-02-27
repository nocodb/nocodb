export type DashboardV3ListItemType = {
  id: string;
  title: string;
  description: string | null;
  base_id: string;
  workspace_id: string;
  order: number | null;
  options: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string;
  owned_by: string;
};

export type DashboardV3ListResponseType = {
  list: DashboardV3ListItemType[];
};

export type WidgetV3Type = {
  id: string;
  title: string;
  description: string | null;
  dashboard_id: string;
  type: string;
  options: Record<string, unknown>;
  meta: Record<string, unknown>;
  order: number | null;
  position: { x: number; y: number; w: number; h: number } | null;
  model_id: string | null;
  view_id: string | null;
  error: boolean;
  created_at: string;
  updated_at: string;
};

export type DashboardV3GetResponseType = DashboardV3ListItemType & {
  widgets?: WidgetV3Type[];
};

export type WidgetV3ListResponseType = {
  list: WidgetV3Type[];
};

export type DashboardV3DataResponseType = {
  widgets: Record<string, unknown>;
};

// --- Dashboard request types ---

export type DashboardV3CreateRequestType = {
  title: string;
  description?: string | null;
  options?: Record<string, unknown>;
};

export type DashboardV3UpdateRequestType = {
  title?: string;
  description?: string | null;
  order?: number;
  options?: Record<string, unknown>;
};

// --- Widget request types ---

export type WidgetV3CreateRequestType = {
  title: string;
  description?: string | null;
  type: string;
  options?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  position?: { x: number; y: number; w: number; h: number };
  model_id?: string;
  view_id?: string;
};

export type WidgetV3UpdateRequestType = {
  title?: string;
  description?: string | null;
  options?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  order?: number;
  position?: { x: number; y: number; w: number; h: number };
  model_id?: string;
  view_id?: string;
};
