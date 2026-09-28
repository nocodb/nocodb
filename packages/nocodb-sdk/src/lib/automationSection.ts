/**
 * Automation sections — collapsible folders in the Workflows sidebar that group
 * a base's automations (workflows and scripts).
 *
 * The automations-tab counterpart of `BaseSectionType`. Sections never nest and
 * are scoped to a base (automations have no source dimension). The base renders
 * one ordered list in which sections interleave with unsectioned automations,
 * so a section shares the `order` sequence of the rows it sits among.
 */
export interface AutomationSectionType {
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

export interface AutomationSectionListType {
  list: AutomationSectionType[];
}

export interface AutomationSectionCreateReqType {
  title: string;
  order?: number;
  meta?: Record<string, any>;
}

export interface AutomationSectionUpdateReqType {
  title?: string;
  order?: number;
  meta?: Record<string, any>;
}
