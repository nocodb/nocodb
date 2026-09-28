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
  /**
   * Per-environment value OVERRIDES (staging / custom envs). `value` is the
   * default (production) value; an entry here wins when that environment is
   * active. `value` in an entry is masked under the same rules as the
   * variable's own value.
   */
  environments?: BaseVariableEnvValueType[];
}

/**
 * A per-environment value override for a base variable. Only non-default
 * environments get a row — the production value is `variable.value`.
 * `fk_environment_id` is the reserved `staging` key or a custom `env…` id.
 */
export interface BaseVariableEnvValueType {
  id?: string;
  fk_environment_id?: string;
  value?: string;
}

export interface BaseVariableReqType {
  key: string;
  value?: string;
  description?: string;
  inheritance: BaseVariableInheritance;
  type?: BaseVariableValueType;
}
