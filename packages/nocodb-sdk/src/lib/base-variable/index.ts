import type { BaseVariableMode, BaseVariableValueType } from '~/lib/globals';

export interface BaseVariableType {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  key?: string;
  value?: string;
  description?: string;
  mode?: BaseVariableMode;
  type?: BaseVariableValueType;
  is_sensitive?: boolean;
  order?: number;
}

export interface BaseVariableReqType {
  key: string;
  value?: string;
  description?: string;
  mode: BaseVariableMode;
  type?: BaseVariableValueType;
  is_sensitive?: boolean;
}
