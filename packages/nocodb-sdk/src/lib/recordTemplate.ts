/**
 * Record template types for the record templates feature.
 *
 * Template data format:
 *   { fields: Record<string, any>, ltarState?: Record<string, any> }
 *
 * - `fields`: column title → default value mapping for regular fields
 * - `ltarState`: LTAR column title → linked record(s) or blueprint(s)
 *   - Blueprint items have `_isBlueprint: true` and optionally `_ltarState` for nesting
 */

export interface RecordTemplateType {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  fk_model_id?: string;
  title?: string;
  description?: string;
  template_data?: RecordTemplateDataType | string;
  usage_count?: number;
  enabled?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RecordTemplateDataType {
  fields: Record<string, any>;
  ltarState?: Record<string, any>;
}

export interface RecordTemplateReqType {
  title: string;
  description?: string;
  template_data: RecordTemplateDataType;
}

export interface RecordTemplateUpdateReqType {
  title?: string;
  description?: string;
  template_data?: RecordTemplateDataType;
  enabled?: boolean;
}
