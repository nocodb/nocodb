export enum OrgUserRoles {
  SUPER_ADMIN = 'super',
  CREATOR = 'org-level-creator',
  VIEWER = 'org-level-viewer',
}

export enum ProjectRoles {
  OWNER = 'owner',
  CREATOR = 'creator',
  EDITOR = 'editor',
  COMMENTER = 'commenter',
  VIEWER = 'viewer',
}

export enum WorkspaceUserRoles {
  OWNER = 'workspace-level-owner',
  CREATOR = 'workspace-level-creator',
  VIEWER = 'workspace-level-viewer',
}

export enum AppEvents {
  PROJECT_CREATE = 'project.create',
  PROJECT_INVITE = 'project.invite',
  PROJECT_DELETE = 'project.delete',
  PROJECT_UPDATE = 'project.update',
  PROJECT_CLONE = 'project.clone',

  WELCOME = 'app.welcome',

  WORKSPACE_CREATE = 'workspace.create',
  WORKSPACE_INVITE = 'workspace.invite',
  WORKSPACE_DELETE = 'workspace.delete',
  WORKSPACE_UPDATE = 'workspace.update',

  USER_SIGNUP = 'user.signup',
  USER_SIGNIN = 'user.signin',
  USER_UPDATE = 'user.update',
  USER_PASSWORD_RESET = 'user.password.reset',
  USER_PASSWORD_CHANGE = 'user.password.change',
  USER_DELETE = 'user.delete',

  TABLE_CREATE = 'table.create',
  TABLE_DELETE = 'table.delete',
  TABLE_UPDATE = 'table.update',

  VIEW_CREATE = 'view.create',
  VIEW_DELETE = 'view.delete',
  VIEW_UPDATE = 'view.update',

  SHARED_VIEW_CREATE = 'shared.view.create',
  SHARED_VIEW_DELETE = 'shared.view.delete',
  SHARED_VIEW_UPDATE = 'shared.view.update',

  FILTER_CREATE = 'filter.create',
  FILTER_DELETE = 'filter.delete',
  FILTER_UPDATE = 'filter.update',

  SORT_CREATE = 'sort.create',
  SORT_DELETE = 'sort.delete',
  SORT_UPDATE = 'sort.update',

  COLUMN_CREATE = 'column.create',
  COLUMN_DELETE = 'column.delete',
  COLUMN_UPDATE = 'column.update',

  BASE_CREATE = 'base.create',
  BASE_DELETE = 'base.delete',
  BASE_UPDATE = 'base.update',

  HOOK_CREATE = 'hook.create',
  HOOK_DELETE = 'hook.delete',
  HOOK_UPDATE = 'hook.update',

  API_TOKEN_CREATE = 'api.token.create',
  API_TOKEN_DELETE = 'api.token.delete',
  API_TOKEN_UPDATE = 'api.token.update',

  DATA_CREATE = 'data.create',
  DATA_DELETE = 'data.delete',
  DATA_UPDATE = 'data.update',
}
