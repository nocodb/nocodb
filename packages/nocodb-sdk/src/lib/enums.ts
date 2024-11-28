export enum OrgUserRoles {
  SUPER_ADMIN = 'super',
  CREATOR = 'org-level-creator',
  VIEWER = 'org-level-viewer',
}

export enum CloudOrgUserRoles {
  CREATOR = 'cloud-org-level-creator',
  VIEWER = 'cloud-org-level-viewer',
  OWNER = 'cloud-org-level-owner',
}

export enum ProjectRoles {
  OWNER = 'owner',
  CREATOR = 'creator',
  EDITOR = 'editor',
  COMMENTER = 'commenter',
  VIEWER = 'viewer',
  NO_ACCESS = 'no-access',
}

export enum WorkspaceUserRoles {
  OWNER = 'workspace-level-owner',
  CREATOR = 'workspace-level-creator',
  EDITOR = 'workspace-level-editor',
  COMMENTER = 'workspace-level-commenter',
  VIEWER = 'workspace-level-viewer',
  NO_ACCESS = 'workspace-level-no-access',
}

export enum AppEvents {
  PROJECT_CREATE = 'base.create',
  PROJECT_INVITE = 'base.invite',
  PROJECT_USER_UPDATE = 'base.user.update',
  PROJECT_USER_RESEND_INVITE = 'base.user.resend.invite',
  PROJECT_DELETE = 'base.delete',
  PROJECT_UPDATE = 'base.update',
  PROJECT_CLONE = 'base.clone',

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

  BASE_CREATE = 'source.create',
  BASE_DELETE = 'source.delete',
  BASE_UPDATE = 'source.update',

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
  WEBHOOK_TRIGGER = 'webhook.trigger',

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

  EXTENSION_CREATE = 'extension.create',
  EXTENSION_UPDATE = 'extension.update',
  EXTENSION_DELETE = 'extension.delete',

  COMMENT_CREATE = 'comment.create',
  COMMENT_DELETE = 'comment.delete',
  COMMENT_UPDATE = 'comment.update',
  INTEGRATION_DELETE = 'integration.delete',
  INTEGRATION_CREATE = 'integration.create',
  INTEGRATION_UPDATE = 'integration.update',

  ROW_USER_MENTION = 'row.user.mention',
}

export enum ClickhouseTables {
  API_CALLS = 'usage_api_calls',
  API_COUNT = 'usage_api_count',
  NOTIFICATION = 'nc_notification',
  PAGE_SNAPSHOT = 'docs_page_snapshot',
  TELEMETRY = 'usage_telemetry',
  AUDIT = 'nc_audit',
}

export enum WorkspaceStatus {
  CREATING,
  CREATED,
  DELETING,
  DELETED,
  FAILED,
}

export enum WorkspacePlan {
  FREE = 'free',
  TEAM = 'team',
  BUSINESS = 'business',
}

export const RoleLabels = {
  [WorkspaceUserRoles.OWNER]: 'owner',
  [WorkspaceUserRoles.CREATOR]: 'creator',
  [WorkspaceUserRoles.EDITOR]: 'editor',
  [WorkspaceUserRoles.COMMENTER]: 'commenter',
  [WorkspaceUserRoles.VIEWER]: 'viewer',
  [WorkspaceUserRoles.NO_ACCESS]: 'noaccess',
  [ProjectRoles.OWNER]: 'owner',
  [ProjectRoles.CREATOR]: 'creator',
  [ProjectRoles.EDITOR]: 'editor',
  [ProjectRoles.COMMENTER]: 'commenter',
  [ProjectRoles.VIEWER]: 'viewer',
  [ProjectRoles.NO_ACCESS]: 'noaccess',
  [OrgUserRoles.SUPER_ADMIN]: 'superAdmin',
  [OrgUserRoles.CREATOR]: 'creator',
  [OrgUserRoles.VIEWER]: 'viewer',
  [CloudOrgUserRoles.OWNER]: 'owner',
  [CloudOrgUserRoles.CREATOR]: 'creator',
  [CloudOrgUserRoles.VIEWER]: 'viewer',
};

export const RoleColors = {
  [WorkspaceUserRoles.OWNER]: 'purple',
  [WorkspaceUserRoles.CREATOR]: 'blue',
  [WorkspaceUserRoles.EDITOR]: 'green',
  [WorkspaceUserRoles.COMMENTER]: 'orange',
  [WorkspaceUserRoles.VIEWER]: 'yellow',
  [WorkspaceUserRoles.NO_ACCESS]: 'red',
  [ProjectRoles.OWNER]: 'purple',
  [ProjectRoles.CREATOR]: 'blue',
  [ProjectRoles.EDITOR]: 'green',
  [ProjectRoles.COMMENTER]: 'orange',
  [ProjectRoles.VIEWER]: 'yellow',
  [OrgUserRoles.SUPER_ADMIN]: 'maroon',
  [ProjectRoles.NO_ACCESS]: 'red',
  [OrgUserRoles.CREATOR]: 'blue',
  [OrgUserRoles.VIEWER]: 'yellow',
  [CloudOrgUserRoles.OWNER]: 'purple',
  [CloudOrgUserRoles.CREATOR]: 'blue',
  [CloudOrgUserRoles.VIEWER]: 'yellow',
};

export const RoleDescriptions = {
  [WorkspaceUserRoles.OWNER]: 'Full access to workspace',
  [WorkspaceUserRoles.CREATOR]:
    'Can create bases, sync tables, views, setup web-hooks and more',
  [WorkspaceUserRoles.EDITOR]: 'Can edit data in workspace bases',
  [WorkspaceUserRoles.COMMENTER]:
    'Can view and comment data in workspace bases',
  [WorkspaceUserRoles.VIEWER]: 'Can view data in workspace bases',
  [WorkspaceUserRoles.NO_ACCESS]: 'Cannot access this workspace',
  [ProjectRoles.OWNER]: 'Full access to base',
  [ProjectRoles.CREATOR]:
    'Can create tables, views, setup webhook, invite collaborators and more',
  [ProjectRoles.EDITOR]: 'Can view, add & modify records, add comments on them',
  [ProjectRoles.COMMENTER]: 'Can view records and add comment on them',
  [ProjectRoles.VIEWER]: 'Can only view records',
  [ProjectRoles.NO_ACCESS]: 'Cannot access this base',
  [OrgUserRoles.SUPER_ADMIN]: 'Full access to all',
  [OrgUserRoles.CREATOR]:
    'Can create bases, sync tables, views, setup web-hooks and more',
  [OrgUserRoles.VIEWER]: 'Can only view bases',
};

export const RoleIcons = {
  [WorkspaceUserRoles.OWNER]: 'role_owner',
  [WorkspaceUserRoles.CREATOR]: 'role_creator',
  [WorkspaceUserRoles.EDITOR]: 'role_editor',
  [WorkspaceUserRoles.COMMENTER]: 'role_commenter',
  [WorkspaceUserRoles.VIEWER]: 'role_viewer',
  [WorkspaceUserRoles.NO_ACCESS]: 'role_no_access',
  [ProjectRoles.OWNER]: 'role_owner',
  [ProjectRoles.CREATOR]: 'role_creator',
  [ProjectRoles.EDITOR]: 'role_editor',
  [ProjectRoles.COMMENTER]: 'role_commenter',
  [ProjectRoles.VIEWER]: 'role_viewer',
  [ProjectRoles.NO_ACCESS]: 'role_no_access',
  [OrgUserRoles.SUPER_ADMIN]: 'role_super',
  [OrgUserRoles.CREATOR]: 'role_creator',
  [OrgUserRoles.VIEWER]: 'role_viewer',

  [CloudOrgUserRoles.OWNER]: 'role_owner',
  [CloudOrgUserRoles.CREATOR]: 'role_creator',
  [CloudOrgUserRoles.VIEWER]: 'role_viewer',
};

export const WorkspaceRolesToProjectRoles = {
  [WorkspaceUserRoles.OWNER]: ProjectRoles.OWNER,
  [WorkspaceUserRoles.CREATOR]: ProjectRoles.CREATOR,
  [WorkspaceUserRoles.EDITOR]: ProjectRoles.EDITOR,
  [WorkspaceUserRoles.COMMENTER]: ProjectRoles.COMMENTER,
  [WorkspaceUserRoles.VIEWER]: ProjectRoles.VIEWER,
  [WorkspaceUserRoles.NO_ACCESS]: ProjectRoles.NO_ACCESS,
};

export const OrderedWorkspaceRoles = [
  WorkspaceUserRoles.OWNER,
  WorkspaceUserRoles.CREATOR,
  WorkspaceUserRoles.EDITOR,
  WorkspaceUserRoles.COMMENTER,
  WorkspaceUserRoles.VIEWER,
  WorkspaceUserRoles.NO_ACCESS,
];

export const OrderedOrgRoles = [
  OrgUserRoles.SUPER_ADMIN,
  OrgUserRoles.CREATOR,
  OrgUserRoles.VIEWER,
];

export const OrderedProjectRoles = [
  ProjectRoles.OWNER,
  ProjectRoles.CREATOR,
  ProjectRoles.EDITOR,
  ProjectRoles.COMMENTER,
  ProjectRoles.VIEWER,
  ProjectRoles.NO_ACCESS,
];

export enum PlanLimitTypes {
  // PER USER
  FREE_WORKSPACE_LIMIT = 'FREE_WORKSPACE_LIMIT',

  // PER WORKSPACE
  WORKSPACE_USER_LIMIT = 'WORKSPACE_USER_LIMIT',
  WORKSPACE_ROW_LIMIT = 'WORKSPACE_ROW_LIMIT',
  BASE_LIMIT = 'BASE_LIMIT',

  // PER BASE
  SOURCE_LIMIT = 'SOURCE_LIMIT',

  // PER BASE
  TABLE_LIMIT = 'TABLE_LIMIT',

  // PER TABLE
  COLUMN_LIMIT = 'COLUMN_LIMIT',
  TABLE_ROW_LIMIT = 'TABLE_ROW_LIMIT',
  WEBHOOK_LIMIT = 'WEBHOOK_LIMIT',
  VIEW_LIMIT = 'VIEW_LIMIT',

  // PER VIEW
  FILTER_LIMIT = 'FILTER_LIMIT',
  SORT_LIMIT = 'SORT_LIMIT',
}

export enum APIContext {
  VIEW_COLUMNS = 'fields',
  FILTERS = 'filters',
  SORTS = 'sorts',
}

export enum SourceRestriction {
  SCHEMA_READONLY = 'is_schema_readonly',
  DATA_READONLY = 'is_data_readonly',
}

export enum ClientType {
  MYSQL = 'mysql2',
  MSSQL = 'mssql',
  PG = 'pg',
  SQLITE = 'sqlite3',
  VITESS = 'vitess',
  SNOWFLAKE = 'snowflake',
  DATABRICKS = 'databricks',
}

export enum SSLUsage {
  No = 'No',
  Allowed = 'Allowed',
  Preferred = 'Preferred',
  Required = 'Required',
  RequiredWithCa = 'Required-CA',
  RequiredWithIdentity = 'Required-Identity',
}

export enum SyncDataType {
  // Database
  MICROSOFT_ACCESS = 'microsoft-access',
  TABLEAU = 'tableau',
  ORACLE = 'oracle',
  // AI
  OPENAI = 'openai',
  CLAUDE = 'claude',
  OLLAMA = 'ollama',
  GROQ = 'groq',
  // Communication
  SLACK = 'slack',
  DISCORD = 'discord',
  TWILLO = 'twillo',
  MICROSOFT_OUTLOOK = 'microsoft-outlook',
  MICROSOFT_TEAMS = 'microsoft-teams',
  TELEGRAM = 'telegram',
  GMAIL = 'gmail',
  WHATSAPP = 'whatsapp',
  // Project Management
  ASANA = 'asana',
  JIRA = 'jira',
  MIRO = 'miro',
  TRELLO = 'trello',
  // CRM
  SALESFORCE = 'salesforce',
  PIPEDRIVE = 'pipedrive',
  MICROSOFT_DYNAMICS_365 = 'microsoft-dynamics-365',
  ZOHO_CRM = 'zoho-crm',
  // Marketing
  HUBSPOT = 'hubspot',
  MAILCHIMP = 'mailchimp',
  SURVEYMONKEY = 'surveymonkey',
  TYPEFORM = 'typeform',
  // ATS
  WORKDAY = 'workday',
  GREENHOUSE = 'greenhouse',
  LEVER = 'lever',
  // Development
  GITHUB = 'github',
  GITLAB = 'gitlab',
  BITBUCKET = 'bitbucket',
  // Finance
  STRIPE = 'stripe',
  QUICKBOOKS = 'quickbooks',
  // Ticketing
  FRESHDESK = 'freshdesk',
  INTERCOM = 'intercom',
  ZENDESK = 'zendesk',
  HUBSPOT_SERVICE_HUB = 'hubspot-service-hub',
  SALESFORCE_SERVICE_CLOUD = 'salesforce-service-cloud',
  // Storage
  BOX = 'box',
  GOOGLE_DRIVE = 'google-drive',
  DROPBOX = 'dropbox',
  // Others
  APPLE_NUMBERS = 'apple-numbers',
  GOOGLE_CALENDAR = 'google-calendar',
  MICROSOFT_EXCEL = 'microsoft-excel',
  GOOGLE_SHEETS = 'google-sheets',
}

export enum IntegrationCategoryType {
  DATABASE = 'database',
  AI = 'ai',
  COMMUNICATION = 'communication',
  SPREAD_SHEET = 'spread-sheet',
  PROJECT_MANAGEMENT = 'project-management',
  CRM = 'crm',
  MARKETING = 'marketing',
  ATS = 'ats',
  DEVELOPMENT = 'development',
  FINANCE = 'finance',
  TICKETING = 'ticketing',
  STORAGE = 'storage',
  OTHERS = 'others',
}

export enum ViewLockType {
  Personal = 'personal',
  Locked = 'locked',
  Collaborative = 'collaborative',
}

export enum PublicAttachmentScope {
  WORKSPACEPICS = 'workspacePics',
  PROFILEPICS = 'profilePics',
  ORGANIZATIONPICS = 'organizationPics',
}
