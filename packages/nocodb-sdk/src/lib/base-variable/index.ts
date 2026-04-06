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
}

export interface BaseVariableReqType {
  key: string;
  value?: string;
  description?: string;
  inheritance: BaseVariableInheritance;
  type?: BaseVariableValueType;
}
