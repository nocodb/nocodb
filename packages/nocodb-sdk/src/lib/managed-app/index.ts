import type {
  DeploymentStatus,
  DeploymentType,
  ManagedAppVersionStatus,
  ManagedAppVisibility,
} from '~/lib/globals';

export interface ManagedAppType {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  title?: string;
  description?: string;
  created_by?: string;
  visibility?: ManagedAppVisibility;
  category?: string;
  install_count?: number;
  meta?: Record<string, any>;
  deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
}

export interface ManagedAppVersionType {
  id?: string;
  fk_managed_app_id?: string;
  fk_workspace_id?: string;
  version?: string;
  version_number?: number;
  status?: ManagedAppVersionStatus;
  schema?: string;
  release_notes?: string;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
}

export interface ManagedAppDeploymentLogType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_managed_app_id?: string;
  from_version_id?: string;
  to_version_id?: string;
  status?: DeploymentStatus;
  deployment_type?: DeploymentType;
  error_message?: string;
  deployment_log?: string;
  meta?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  started_at?: string;
  completed_at?: string;
}

export interface ManagedAppReqType {
  title: string;
  description?: string;
  visibility?: ManagedAppVisibility;
  category?: string;
}
