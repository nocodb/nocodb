import type { FilterType } from '~/lib/Api';

import type { SubjectHierarchyScope } from '~/lib/permission';

export type { SubjectHierarchyScope };

export interface RlsPolicySubjectType {
  type: 'user' | 'team' | 'role';
  id: string; // User ID, team ID, or role string (e.g., 'editor', 'viewer')
  hierarchy_scope?: SubjectHierarchyScope; // Only meaningful for 'team' type. Default: 'self_and_descendants'
}

export type RlsDefaultBehavior = 'show_all' | 'deny_all' | 'condition';

export interface RlsPolicyType {
  id?: string;
  base_id?: string;
  source_id?: string;
  fk_model_id?: string;
  title?: string;
  enabled?: boolean;
  is_default?: boolean; // true for the 'everyone' fallback policy
  default_behavior?: RlsDefaultBehavior; // Only when is_default = true
  order?: number;
  meta?: Record<string, any>;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  subjects?: RlsPolicySubjectType[]; // Users, teams, roles assigned to this policy
  filters?: FilterType[]; // Nested filter tree
}

export interface RlsPolicyCreateReqType {
  fk_model_id: string;
  title?: string;
  is_default?: boolean;
  default_behavior?: RlsDefaultBehavior;
  subjects?: RlsPolicySubjectType[];
  filters?: Partial<FilterType>[];
}

export interface RlsPolicyUpdateReqType {
  id: string;
  title?: string;
  enabled?: boolean;
  default_behavior?: RlsDefaultBehavior;
  order?: number;
}

export interface RlsPolicySetSubjectsReqType {
  id: string;
  subjects: RlsPolicySubjectType[];
}

export interface RlsPolicyTestResultType {
  matchedRows: number;
  totalRows: number;
  sampleRows?: Record<string, any>[];
}
