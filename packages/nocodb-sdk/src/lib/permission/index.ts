import { ProjectRoles, WorkspaceUserRoles } from '../enums'

export enum PermissionKey {
  TABLE_RECORD_ADD = 'TABLE_RECORD_ADD',
  TABLE_RECORD_DELETE = 'TABLE_RECORD_DELETE',
  RECORD_FIELD_EDIT = 'RECORD_FIELD_EDIT',
}

export enum PermissionGrantedType {
  ROLE = 'role',
  USER = 'user',
  NOBODY = 'nobody',
}

export enum PermissionEntity {
  TABLE = 'table',
  FIELD = 'field',
}

export enum PermissionRole {
  OWNER = 'owner',
  CREATOR = 'creator',
  EDITOR = 'editor',
  COMMENTER = 'commenter',
  VIEWER = 'viewer',
}

export const PermissionRolePower = {
  [PermissionRole.OWNER]: 6,
  [PermissionRole.CREATOR]: 5,
  [PermissionRole.EDITOR]: 4,
  [PermissionRole.COMMENTER]: 3,
  [PermissionRole.VIEWER]: 2,
};

export const PermissionRoleMap = {
  [ProjectRoles.OWNER]: PermissionRole.OWNER,
  [ProjectRoles.CREATOR]: PermissionRole.CREATOR,
  [ProjectRoles.EDITOR]: PermissionRole.EDITOR,
  [ProjectRoles.COMMENTER]: PermissionRole.COMMENTER,
  [ProjectRoles.VIEWER]: PermissionRole.VIEWER,
  [WorkspaceUserRoles.OWNER]: PermissionRole.OWNER,
  [WorkspaceUserRoles.CREATOR]: PermissionRole.CREATOR,
  [WorkspaceUserRoles.EDITOR]: PermissionRole.EDITOR,
  [WorkspaceUserRoles.COMMENTER]: PermissionRole.COMMENTER,
  [WorkspaceUserRoles.VIEWER]: PermissionRole.VIEWER,
};