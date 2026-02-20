import { ProjectRoles } from 'src/lib/enums';

export type WorkflowRunAsType = 'service_account' | 'role' | 'user';

export interface WorkflowRunAs {
  type: WorkflowRunAsType;
  value?: string;
  display_label?: string;
}

export const RUN_AS_ALLOWED_ROLES = [
  ProjectRoles.VIEWER,
  ProjectRoles.COMMENTER,
  ProjectRoles.EDITOR,
  ProjectRoles.CREATOR,
] as const;
