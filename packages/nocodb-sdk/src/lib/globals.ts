import { OrgUserRoles, ProjectRoles, WorkspaceUserRoles } from './enums';

export enum ViewTypes {
  FORM = 1,
  GALLERY = 2,
  GRID = 3,
  KANBAN = 4,
  MAP = 5,
  CALENDAR = 6,
}

export enum ProjectTypes {
  DATABASE = 'database',
  DOCUMENTATION = 'documentation',
  COWRITER = 'cowriter',
  DASHBOARD = 'dashboard',
}

export enum RelationTypes {
  HAS_MANY = 'hm',
  BELONGS_TO = 'bt',
  MANY_TO_MANY = 'mm',
  ONE_TO_ONE = 'oo',
}

export enum ExportTypes {
  EXCEL = 'excel',
  CSV = 'csv',
}

export enum AuditOperationTypes {
  COMMENT = 'COMMENT',
  DATA = 'DATA',
  PROJECT = 'PROJECT',
  VIRTUAL_RELATION = 'VIRTUAL_RELATION',
  RELATION = 'RELATION',
  TABLE_VIEW = 'TABLE_VIEW',
  TABLE = 'TABLE',
  VIEW = 'VIEW',
  META = 'META',
  WEBHOOKS = 'WEBHOOKS',
  AUTHENTICATION = 'AUTHENTICATION',
  TABLE_COLUMN = 'TABLE_COLUMN',
  ORG_USER = 'ORG_USER',
}

export enum AuditOperationSubTypes {
  UPDATE = 'UPDATE',
  INSERT = 'INSERT',
  BULK_INSERT = 'BULK_INSERT',
  BULK_UPDATE = 'BULK_UPDATE',
  BULK_DELETE = 'BULK_DELETE',
  LINK_RECORD = 'LINK_RECORD',
  UNLINK_RECORD = 'UNLINK_RECORD',
  DELETE = 'DELETE',
  CREATE = 'CREATE',
  RENAME = 'RENAME',
  IMPORT_FROM_ZIP = 'IMPORT_FROM_ZIP',
  EXPORT_TO_FS = 'EXPORT_TO_FS',
  EXPORT_TO_ZIP = 'EXPORT_TO_ZIP',
  SIGNIN = 'SIGNIN',
  SIGNUP = 'SIGNUP',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_FORGOT = 'PASSWORD_FORGOT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  ROLES_MANAGEMENT = 'ROLES_MANAGEMENT',
  INVITE = 'INVITE',
  RESEND_INVITE = 'RESEND_INVITE',
}

export enum PluginCategory {
  STORAGE = 'Storage',
  EMAIL = 'Email',
}

export enum ModelTypes {
  TABLE = 'table',
  VIEW = 'view',
}

export enum ProjectStatus {
  JOB = 'job',
}

export enum TiptapNodesTypes {
  doc = 'doc',
  sec = 'sec',
  paragraph = 'paragraph',
  text = 'text',
  heading = 'heading',
  bullet = 'bullet',
  ordered = 'ordered',
  task = 'task',
  quote = 'quote',
  divider = 'divider',
  codeBlock = 'codeBlock',
  image = 'image',
  callout = 'callout',
  tipCallout = 'tipCallout',
  table = 'table',
  tableRow = 'tableRow',
  tableCell = 'tableCell',
  embed = 'embed',
  collapsable = 'collapsable',
  collapsableContent = 'collapsable_content',
  collapsableHeader = 'collapsable_header',
  column = 'column',
  columnContent = 'columnContent',
  linkToPage = 'linkToPage',
  attachment = 'attachment',
}

export enum TiptapMarksTypes {
  strike = 'strike',
  bold = 'bold',
  italic = 'italic',
  link = 'link',
  code = 'code',
  underline = 'underline',
}

export enum NcDataErrorCodes {
  NC_ERR_MM_MODEL_NOT_FOUND = 'NC_ERR_MM_MODEL_NOT_FOUND',
}

export enum NcErrorType {
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  API_TOKEN_NOT_ALLOWED = 'API_TOKEN_NOT_ALLOWED',
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  BASE_NOT_FOUND = 'BASE_NOT_FOUND',
  SOURCE_NOT_FOUND = 'SOURCE_NOT_FOUND',
  TABLE_NOT_FOUND = 'TABLE_NOT_FOUND',
  VIEW_NOT_FOUND = 'VIEW_NOT_FOUND',
  FIELD_NOT_FOUND = 'FIELD_NOT_FOUND',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  ERROR_DUPLICATE_RECORD = 'ERROR_DUPLICATE_RECORD',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_OFFSET_VALUE = 'INVALID_OFFSET_VALUE',
  INVALID_LIMIT_VALUE = 'INVALID_LIMIT_VALUE',
  INVALID_FILTER = 'INVALID_FILTER',
  INVALID_SHARED_VIEW_PASSWORD = 'INVALID_SHARED_VIEW_PASSWORD',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  BAD_JSON = 'BAD_JSON',
}

type Roles = OrgUserRoles | ProjectRoles | WorkspaceUserRoles;

type RolesObj = Partial<Record<Roles, boolean>>;

type RolesType = RolesObj | string[] | string;

export { Roles, RolesObj, RolesType };
