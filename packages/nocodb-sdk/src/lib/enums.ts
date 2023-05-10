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

export enum AppEvents {
  PROJECT_CREATE = 'project.create',
  PROJECT_INVITE = 'project.invite',
  PROJECT_USER_UPDATE = 'project.user.update',
  PROJECT_USER_RESEND_INVITE = 'project.user.resend.invite',
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
  USER_PASSWORD_FORGOT = 'user.password.forgot',
  USER_DELETE = 'user.delete',
  USER_EMAIL_VERIFICATION = 'user.email.verification',

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

  DATA_CREATE = 'data.create',
  DATA_DELETE = 'data.delete',
  DATA_UPDATE = 'data.update',

  ORG_USER_INVITE = 'org.user.invite',
  ORG_USER_RESEND_INVITE = 'org.user.resend.invite',

  VIEW_COLUMN_CREATE = 'view.column.create',
  VIEW_COLUMN_UPDATE = 'view.column.update',

  API_TOKEN_CREATE = 'api.token.create',
  API_TOKEN_DELETE = 'api.token.delete',
  IMAGE_UPLOAD = 'image.upload',

  BASE_CREATE = 'base.create',
  BASE_DELETE = 'base.delete',
  BASE_UPDATE = 'base.update',

  FORM_COLUMN_UPDATE = 'form.column.update',

  FORM_CREATE = 'form.create',
  FORM_UPDATE = 'form.update',

  GALLERY_CREATE = 'gallery.create',
  GALLERY_UPDATE = 'gallery.update',

  KANBAN_CREATE = 'kanban.create',
  KANBAN_UPDATE = 'kanban.update',

  MAP_CREATE = 'map.create',
  MAP_UPDATE = 'map.update',

  META_DIFF_SYNC = 'meta.diff.sync',

  GRID_CREATE = 'grid.create',
  GRID_UPDATE = 'grid.update',

  GRID_COLUMN_UPDATE = 'grid.column.update',

  WEBHOOK_CREATE = 'webhook.create',
  WEBHOOK_UPDATE = 'webhook.update',
  WEBHOOK_DELETE = 'webhook.delete',
  WEBHOOK_TEST = 'webhook.test',

  UI_ACL_UPDATE = 'ui.acl.update',

  ORG_API_TOKEN_CREATE = 'org.api.token.create',
  ORG_API_TOKEN_DELETE = 'org.api.token.delete',

  PLUGIN_TEST = 'plugin.test',
  PLUGIN_INSTALL = 'plugin.install',
  PLUGIN_UNINSTALL = 'plugin.uninstall',

  SYNC_SOURCE_CREATE = 'sync.source.create',
  SYNC_SOURCE_UPDATE = 'sync.source.update',
  SYNC_SOURCE_DELETE = 'sync.source.delete',

  RELATION_DELETE = 'relation.delete',
  RELATION_CREATE = 'relation.create',

  SHARED_BASE_GENERATE_LINK = 'shared.base.generate.link',
  SHARED_BASE_DELETE_LINK = 'shared.base.delete.link',

  ATTACHMENT_UPLOAD = 'attachment.upload',

  APIS_CREATED = 'apis.created',
}
