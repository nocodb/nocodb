import { ProjectRoles, WorkspaceUserRoles } from '../enums';

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

// Permission option values used across the application
export enum PermissionOptionValue {
  VIEWERS_AND_UP = 'viewers_and_up',
  EDITORS_AND_UP = 'editors_and_up',
  CREATORS_AND_UP = 'creators_and_up',
  SPECIFIC_USERS = 'specific_users',
  NOBODY = 'nobody',
}

export interface PermissionOption {
  value: PermissionOptionValue;
  label: string;
  description: string;
  icon: string;
  isDefault?: boolean;
}

export const PermissionOptions: PermissionOption[] = [
  {
    value: PermissionOptionValue.CREATORS_AND_UP,
    label: 'Creators & up',
    description: 'Members with Creator or Owner role',
    icon: 'role_creator',
  },
  {
    value: PermissionOptionValue.EDITORS_AND_UP,
    label: 'Editors & up',
    description: 'Members with Editor, Creator or Owner role',
    icon: 'role_editor',
    isDefault: true,
  },
  {
    value: PermissionOptionValue.VIEWERS_AND_UP,
    label: 'Viewers and up',
    description: 'Members with Viewer, Editor, Creator or Owner role',
    icon: 'role_viewer',
  },
  {
    value: PermissionOptionValue.SPECIFIC_USERS,
    label: 'Specific users',
    description: 'Specific set of members',
    icon: 'ncUsers',
  },
  {
    value: PermissionOptionValue.NOBODY,
    label: 'Nobody',
    description: 'No one can add records',
    icon: 'role_no_access',
  },
];

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

export const PermissionMeta = {
  [PermissionKey.TABLE_RECORD_ADD]: {
    minimumRole: PermissionRole.EDITOR,
    label: 'Who can create records',
    description: 'can create records',
    userSelectorDescription:
      'Only members selected here will be able to create records.',
  },
  [PermissionKey.TABLE_RECORD_DELETE]: {
    minimumRole: PermissionRole.EDITOR,
    label: 'Who can delete records',
    description: 'can delete records',
    userSelectorDescription:
      'Only members selected here will be able to delete records.',
  },
  [PermissionKey.RECORD_FIELD_EDIT]: {
    minimumRole: PermissionRole.EDITOR,
    label: 'Who can edit data in this field',
    description: 'can edit records',
    userSelectorDescription:
      'Only members selected here will be able to edit values in the {{field}} field.',
  },
};

// Utility functions for permission management
export const getPermissionOption = (
  value: string
): PermissionOption | undefined => {
  return PermissionOptions.find((option) => option.value === value);
};

export const getPermissionLabel = (value: string): string => {
  return getPermissionOption(value)?.label || 'Editors & up';
};

export const getPermissionIcon = (value: string): string => {
  return getPermissionOption(value)?.icon || 'role_editor';
};

export const getPermissionOptionValue = (
  grantedType: PermissionGrantedType,
  grantedRole?: PermissionRole
): PermissionOptionValue => {
  if (grantedType === PermissionGrantedType.ROLE) {
    if (grantedRole === PermissionRole.VIEWER) {
      return PermissionOptionValue.VIEWERS_AND_UP;
    } else if (grantedRole === PermissionRole.CREATOR) {
      return PermissionOptionValue.CREATORS_AND_UP;
    } else {
      return PermissionOptionValue.EDITORS_AND_UP;
    }
  } else if (grantedType === PermissionGrantedType.USER) {
    return PermissionOptionValue.SPECIFIC_USERS;
  } else if (grantedType === PermissionGrantedType.NOBODY) {
    return PermissionOptionValue.NOBODY;
  }
  return PermissionOptionValue.EDITORS_AND_UP;
};
