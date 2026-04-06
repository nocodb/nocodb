import type {
  BaseVariableInheritance,
  BaseVariableValueType,
} from '~/lib/globals';

export interface BaseVariableType {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  key?: string;
  value?: string;
  description?: string;
  inheritance?: BaseVariableInheritance;
  type?: BaseVariableValueType;
  order?: number;
  is_overridden?: boolean;
  is_inherited?: boolean;
  fk_integration_id?: string;
  integration_type?: string;
  integration_sub_type?: string;
}

export interface BaseVariableReqType {
  key: string;
  value?: string;
  description?: string;
  inheritance: BaseVariableInheritance;
  type?: BaseVariableValueType;
  fk_integration_id?: string;
}
