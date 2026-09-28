import { ProjectRoles, WorkspaceUserRoles } from '../enums';

export type SubjectHierarchyScope = 'self_only' | 'self_and_descendants';

/**
 * Kinds of principal that can be named as a permission subject.
 * `AGENT` matches by id exactly as `USER` does — an agent is a real principal,
 * not a role.
 */
export enum SubjectType {
  USER = 'user',
  TEAM = 'team',
  AGENT = 'agent',
}

export enum PermissionKey {
  TABLE_VISIBILITY = 'TABLE_VISIBILITY',
  TABLE_RECORD_ADD = 'TABLE_RECORD_ADD',
  TABLE_RECORD_DELETE = 'TABLE_RECORD_DELETE',
  RECORD_FIELD_EDIT = 'RECORD_FIELD_EDIT',
  DOCUMENT_VISIBILITY = 'DOCUMENT_VISIBILITY',
  DOCUMENT_EDIT = 'DOCUMENT_EDIT',
  DASHBOARD_VISIBILITY = 'DASHBOARD_VISIBILITY',
  DASHBOARD_EDIT = 'DASHBOARD_EDIT',
  ROUTINE_INVOKE = 'ROUTINE_INVOKE',
  APP_USE = 'APP_USE',
  CHAT_ARTIFACT_VISIBILITY = 'CHAT_ARTIFACT_VISIBILITY',
}

export enum PermissionGrantedType {
  ROLE = 'role',
  USER = 'user',
  NOBODY = 'nobody',
}

export enum PermissionEntity {
  TABLE = 'table',
  FIELD = 'field',
  DOCUMENT = 'document',
  DASHBOARD = 'dashboard',
  APP = 'app',
  CHAT_ARTIFACT = 'chat_artifact',
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
  COMMENTERS_AND_UP = 'commenters_and_up',
  EDITORS_AND_UP = 'editors_and_up',
  CREATORS_AND_UP = 'creators_and_up',
  SPECIFIC_USERS = 'specific_users',
  NOBODY = 'nobody',
  EVERYONE = 'everyone',
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
    description:
      'Members with Viewer, Commenter, Editor, Creator or Owner role',
    icon: 'role_viewer',
  },
  {
    value: PermissionOptionValue.SPECIFIC_USERS,
    label: 'Specific users',
    description: 'Specific set of members',
    icon: 'ncUsers',
  },
  {
    value: PermissionOptionValue.EVERYONE,
    label: 'Everyone',
    description: 'All members can access',
    icon: 'ncUsers',
    isDefault: true,
  },
  {
    value: PermissionOptionValue.NOBODY,
    label: 'Nobody',
    description: 'No access for anyone',
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
  // ProjectRoles.APP_USER is deliberately unmapped — an app_user has no
  // permission-role power on the direct data API.
  [WorkspaceUserRoles.OWNER]: PermissionRole.OWNER,
  [WorkspaceUserRoles.CREATOR]: PermissionRole.CREATOR,
  [WorkspaceUserRoles.EDITOR]: PermissionRole.EDITOR,
  [WorkspaceUserRoles.COMMENTER]: PermissionRole.COMMENTER,
  [WorkspaceUserRoles.VIEWER]: PermissionRole.VIEWER,
};

export const PermissionMeta = {
  [PermissionKey.TABLE_VISIBILITY]: {
    minimumRole: PermissionRole.VIEWER,
    label: 'Who can view table',
    description: 'can view table',
    userSelectorDescription:
      'Only members selected here will be able to view and access this table.',
  },
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
  [PermissionKey.DOCUMENT_VISIBILITY]: {
    minimumRole: PermissionRole.VIEWER,
    label: 'Who can view this page',
    description: 'can view page',
    userSelectorDescription:
      'Only members selected here will be able to view this page and its children.',
  },
  [PermissionKey.DOCUMENT_EDIT]: {
    minimumRole: PermissionRole.EDITOR,
    label: 'Who can edit this page',
    description: 'can edit page',
    userSelectorDescription:
      'Only members selected here will be able to edit this page.',
  },
  [PermissionKey.DASHBOARD_VISIBILITY]: {
    minimumRole: PermissionRole.VIEWER,
    label: 'Who can view this dashboard',
    description: 'can view dashboard',
    userSelectorDescription:
      'Only members selected here will be able to view this dashboard.',
  },
  [PermissionKey.DASHBOARD_EDIT]: {
    minimumRole: PermissionRole.EDITOR,
    label: 'Who can edit this dashboard',
    description: 'can edit dashboard',
    userSelectorDescription:
      'Only members selected here will be able to edit this dashboard.',
  },
  [PermissionKey.ROUTINE_INVOKE]: {
    minimumRole: PermissionRole.EDITOR,
    label: 'Who can run this routine',
    description: 'can run routine',
    userSelectorDescription:
      'Only members selected here will be able to run this routine.',
  },
  [PermissionKey.APP_USE]: {
    // VIEWER floor (mirrors DOCUMENT_VISIBILITY): an app can be opened by
    // viewers — the write-gate ensures a viewer only reads.
    minimumRole: PermissionRole.VIEWER,
    label: 'Who can use this app',
    description: 'can use app',
    userSelectorDescription:
      'Only members selected here will be able to use this app.',
  },
  [PermissionKey.CHAT_ARTIFACT_VISIBILITY]: {
    minimumRole: PermissionRole.VIEWER,
    label: 'Who can view this artifact',
    description: 'can view this artifact',
    userSelectorDescription:
      'Only members selected here will be able to view this artifact.',
  },
};

// Restrictiveness order for document permission inheritance (lower = more permissive).
// SPECIFIC_USERS is ranked high (5) by convention: it is treated as more restrictive
// than role-based options because access is explicitly gated to a named set of users.
// Note: the actual restrictiveness of SPECIFIC_USERS depends on which users are
// selected, but for inheritance validation we use this fixed ranking.
export const PermissionOptionRestrictiveness: Record<string, number> = {
  [PermissionOptionValue.EVERYONE]: 0,
  [PermissionOptionValue.VIEWERS_AND_UP]: 1,
  [PermissionOptionValue.COMMENTERS_AND_UP]: 2,
  [PermissionOptionValue.EDITORS_AND_UP]: 3,
  [PermissionOptionValue.CREATORS_AND_UP]: 4,
  [PermissionOptionValue.SPECIFIC_USERS]: 5,
  [PermissionOptionValue.NOBODY]: 6,
};

/**
 * Returns true if `child` is at least as restrictive as `parent`.
 * Uses >= because equal restrictiveness is valid (child may match parent).
 *
 * Unknown values are treated as invalid and return false (fail-closed)
 * to prevent accidentally allowing a more-permissive child.
 */
export const isMoreRestrictive = (
  child: PermissionOptionValue,
  parent: PermissionOptionValue
): boolean => {
  const childLevel = PermissionOptionRestrictiveness[child];
  const parentLevel = PermissionOptionRestrictiveness[parent];

  // Fail-closed: unknown values are never considered "more restrictive"
  if (childLevel === undefined || parentLevel === undefined) {
    return false;
  }

  return childLevel >= parentLevel;
};

export const DOCUMENT_PERMISSION_KEYS = [
  PermissionKey.DOCUMENT_VISIBILITY,
  PermissionKey.DOCUMENT_EDIT,
];

export const DASHBOARD_PERMISSION_KEYS = [
  PermissionKey.DASHBOARD_VISIBILITY,
  PermissionKey.DASHBOARD_EDIT,
];

export const ROUTINE_PERMISSION_KEYS = [PermissionKey.ROUTINE_INVOKE];

export const APP_PERMISSION_KEYS = [PermissionKey.APP_USE];

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
    } else if (grantedRole === PermissionRole.COMMENTER) {
      return PermissionOptionValue.COMMENTERS_AND_UP;
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
  // Default for table visibility is everyone, for others it's editors and up
  return PermissionOptionValue.EDITORS_AND_UP;
};

/** A permission subject — a user, team or agent, optionally with a team hierarchy scope. */
export interface PermissionSubject {
  type: SubjectType | string;
  id: string;
  hierarchy_scope?: SubjectHierarchyScope;
}

/** Minimal shape of a resolved permission the evaluator needs. */
export interface EvaluablePermission {
  granted_type?: PermissionGrantedType | string;
  granted_role?: PermissionRole | string;
  subjects?: PermissionSubject[];
}

/**
 * Whether a user's direct-team memberships satisfy a team subject, using the
 * team `path` (ancestor chain) — a PURE, DB-free rule for callers that already
 * hold the user's `{ team_id, path }[]` (e.g. the frontend). Backends that must
 * also apply org/workspace visibility gating resolve team matching their own
 * way and feed the boolean into `evaluatePermission` instead.
 *
 * - `self_only`      → direct member of exactly the subject team
 * - `self_and_descendants` (default) → direct member of the subject team OR of
 *   any descendant (a team whose path contains the subject id as a segment)
 */
export const matchesTeamSubjectByPaths = (
  subject: Pick<PermissionSubject, 'id' | 'hierarchy_scope'>,
  directTeams: { team_id: string; path: string }[]
): boolean => {
  if (subject.hierarchy_scope === 'self_only') {
    return directTeams.some((t) => t.team_id === subject.id);
  }
  return directTeams.some((t) => {
    if (t.team_id === subject.id) return true;
    return t.path.split('/').filter(Boolean).includes(subject.id);
  });
};

/**
 * The single, shared permission decision — the same rule the frontend
 * (`usePermissions`) and the backend (`Permission.isAllowed`) must agree on, so
 * they can never drift.
 *
 * Team-subject matching is intentionally NOT done here: it differs by tier
 * (the frontend matches on cached team paths; the backend does DB-backed
 * descendant expansion plus org/workspace visibility gating). Each caller
 * resolves its own team match and passes the boolean as `matchedTeamSubject`.
 *
 * @param permission the resolved permission (null/undefined ⇒ allowed)
 * @param principal.userId caller's id — a user id, or an agent id when
 *   `subjectType` is AGENT
 * @param principal.subjectType which kind of principal `userId` names.
 *   Defaults to USER, so existing callers keep their exact behaviour. A
 *   principal only ever matches a subject of its OWN type: an agent id must
 *   never satisfy a `user` grant, nor a user id an `agent` grant, even on the
 *   (impossible) chance the two id spaces collide.
 * @param principal.permissionRole caller's role ALREADY mapped through
 *   `PermissionRoleMap` (a `PermissionRole` key) — used for ROLE grants
 * @param principal.matchedTeamSubject caller-resolved team-subject match.
 *   Always false for agents: an agent has no team memberships.
 */
export const evaluatePermission = (
  permission: EvaluablePermission | null | undefined,
  principal: {
    userId?: string;
    subjectType?: SubjectType;
    permissionRole?: PermissionRole | string;
    matchedTeamSubject?: boolean;
  }
): boolean => {
  if (!permission) return true;

  if (permission.granted_type === PermissionGrantedType.USER) {
    const principalType = principal.subjectType ?? SubjectType.USER;
    const subjectMatch = permission.subjects?.some(
      (s) => s.type === principalType && s.id === principal.userId
    );
    if (subjectMatch) return true;
    return !!principal.matchedTeamSubject;
  }

  if (permission.granted_type === PermissionGrantedType.ROLE) {
    const rolePower =
      PermissionRolePower[
        principal.permissionRole as keyof typeof PermissionRolePower
      ];
    if (rolePower === undefined) return false;
    return (
      rolePower >=
      PermissionRolePower[
        permission.granted_role as keyof typeof PermissionRolePower
      ]
    );
  }

  return false;
};
