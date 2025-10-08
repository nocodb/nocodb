import { ColumnType, FilterType } from './Api';
import { OrgUserRoles, ProjectRoles, WorkspaceUserRoles } from './enums';
import { PlanTitles } from './payment';

export const enumColors = {
  light: [
    '#cfdffe',
    '#d0f1fd',
    '#c2f5e8',
    '#ffdaf6',
    '#ffdce5',
    '#fee2d5',
    '#ffeab6',
    '#d1f7c4',
    '#ede2fe',
    '#eeeeee',
  ],
  dark: [
    '#2d7ff999',
    '#18bfff99',
    '#20d9d299',
    '#ff08c299',
    '#f82b6099',
    '#ff6f2c99',
    '#fcb40099',
    '#20c93399',
    '#8b46ff99',
    '#666',
  ],
  get: (theme: 'light' | 'dark', index: number) => {
    index = Math.abs(index) % enumColors[theme].length;
    return enumColors[theme][index];
  },
};

export enum ViewTypes {
  FORM = 1,
  GALLERY = 2,
  GRID = 3,
  KANBAN = 4,
  MAP = 5,
  CALENDAR = 6,
}

export const viewTypeAlias: Record<ViewTypes, string> = {
  [ViewTypes.FORM]: 'form',
  [ViewTypes.GALLERY]: 'gallery',
  [ViewTypes.GRID]: 'grid',
  [ViewTypes.KANBAN]: 'kanban',
  [ViewTypes.MAP]: 'map',
  [ViewTypes.CALENDAR]: 'calendar',
};

export const viewTypeToStringMap: Record<ViewTypes, string> = {
  ...viewTypeAlias,
};

// Generate reverse mapping from the original viewTypeAlias
export const stringToViewTypeMap: Record<string, ViewTypes> = Object.entries(
  viewTypeAlias
).reduce((acc, [key, value]) => {
  acc[value] = Number(key);
  return acc;
}, {});

export const VIEW_GRID_DEFAULT_WIDTH = 200;

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

export const ExpandedFormMode = {
  FIELD: 'field',
  ATTACHMENT: 'attachment',
  DISCUSSION: 'discussion',
} as const;

export type ExpandedFormModeType =
  (typeof ExpandedFormMode)[keyof typeof ExpandedFormMode];

export enum ExportTypes {
  EXCEL = 'excel',
  CSV = 'csv',
}

export enum PluginCategory {
  STORAGE = 'Storage',
  EMAIL = 'Email',
}

export enum ModelTypes {
  TABLE = 'table',
  VIEW = 'view',
  DASHBOARD = 'dashboard',
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
  ERR_AUTHENTICATION_REQUIRED = 'ERR_AUTHENTICATION_REQUIRED',
  ERR_FORBIDDEN = 'ERR_FORBIDDEN',
  ERR_API_TOKEN_NOT_ALLOWED = 'ERR_API_TOKEN_NOT_ALLOWED',
  ERR_WORKSPACE_NOT_FOUND = 'ERR_WORKSPACE_NOT_FOUND',
  ERR_BASE_NOT_FOUND = 'ERR_BASE_NOT_FOUND',
  ERR_SOURCE_NOT_FOUND = 'ERR_SOURCE_NOT_FOUND',
  ERR_TABLE_NOT_FOUND = 'ERR_TABLE_NOT_FOUND',
  ERR_VIEW_NOT_FOUND = 'ERR_VIEW_NOT_FOUND',
  ERR_FIELD_NOT_FOUND = 'ERR_FIELD_NOT_FOUND',
  ERR_RECORD_NOT_FOUND = 'ERR_RECORD_NOT_FOUND',
  ERR_GENERIC_NOT_FOUND = 'ERR_GENERIC_NOT_FOUND',
  ERR_HOOK_NOT_FOUND = 'ERR_HOOK_NOT_FOUND',
  ERR_REQUIRED_FIELD_MISSING = 'ERR_REQUIRED_FIELD_MISSING',
  ERR_DUPLICATE_RECORD = 'ERR_DUPLICATE_RECORD',
  ERR_USER_NOT_FOUND = 'ERR_USER_NOT_FOUND',
  ERR_INVALID_OFFSET_VALUE = 'ERR_INVALID_OFFSET_VALUE',
  ERR_INVALID_PAGE_VALUE = 'ERR_INVALID_PAGE_VALUE',
  ERR_INVALID_LIMIT_VALUE = 'ERR_INVALID_LIMIT_VALUE',
  ERR_INVALID_FILTER = 'ERR_INVALID_FILTER',
  ERR_INVALID_SHARED_VIEW_PASSWORD = 'ERR_INVALID_SHARED_VIEW_PASSWORD',
  ERR_INVALID_ATTACHMENT_JSON = 'ERR_INVALID_ATTACHMENT_JSON',
  ERR_NOT_IMPLEMENTED = 'ERR_NOT_IMPLEMENTED',
  ERR_INTERNAL_SERVER = 'ERR_INTERNAL_SERVER',
  ERR_DATABASE_OP_FAILED = 'ERR_DATABASE_OP_FAILED',
  ERR_UNKNOWN = 'ERR_UNKNOWN',
  ERR_INVALID_JSON = 'ERR_INVALID_JSON',
  ERR_INVALID_PK_VALUE = 'ERR_INVALID_PK_VALUE',
  ERR_COLUMN_ASSOCIATED_WITH_LINK = 'ERR_COLUMN_ASSOCIATED_WITH_LINK',
  ERR_TABLE_ASSOCIATED_WITH_LINK = 'ERR_TABLE_ASSOCIATED_WITH_LINK',
  ERR_INTEGRATION_NOT_FOUND = 'ERR_INTEGRATION_NOT_FOUND',
  ERR_INTEGRATION_LINKED_WITH_BASES = 'ERR_INTEGRATION_LINKED_WITH_BASES',
  ERR_FORMULA = 'ERR_FORMULA',
  ERR_CIRCULAR_REF_IN_FORMULA = 'ERR_CIRCULAR_REF_IN_FORMULA',
  ERR_PERMISSION_DENIED = 'ERR_PERMISSION_DENIED',
  ERR_INVALID_ATTACHMENT_UPLOAD_SCOPE = 'ERR_INVALID_ATTACHMENT_UPLOAD_SCOPE',
  ERR_CANNOT_CALCULATE_INTERMEDIATE_ORDER = 'ERR_CANNOT_CALCULATE_INTERMEDIATE_ORDER',
  ERR_REORDER_FAILED = 'ERR_REORDER_FAILED',
  ERR_PLAN_LIMIT_EXCEEDED = 'ERR_PLAN_LIMIT_EXCEEDED',
  ERR_FEATURE_NOT_SUPPORTED = 'ERR_FEATURE_NOT_SUPPORTED',
  ERR_SSO_LOGIN_REQUIRED = 'ERR_SSO_LOGIN_REQUIRED',
  ERR_SSO_GENERATED_TOKEN_REQUIRED = 'ERR_SSO_GENERATED_TOKEN_REQUIRED',
  ERR_MAX_INSERT_LIMIT_EXCEEDED = 'ERR_MAX_INSERT_LIMIT_EXCEEDED',
  ERR_INVALID_VALUE_FOR_FIELD = 'ERR_INVALID_VALUE_FOR_FIELD',
  ERR_MAX_WORKSPACE_LIMIT_REACHED = 'ERR_MAX_WORKSPACE_LIMIT_REACHED',
  ERR_BASE_COLLABORATION = 'ERR_BASE_COLLABORATION',
  ERR_ORG_USER = 'ERR_ORG_USER',
  ERR_SYNC_TABLE_OPERATION_PROHIBITED = 'ERR_SYNC_TABLE_OPERATION_PROHIBITED',
  ERR_INVALID_REQUEST_BODY = 'ERR_INVALID_REQUEST_BODY',
  ERR_DASHBOARD_NOT_FOUND = 'ERR_DASHBOARD_NOT_FOUND',
  ERR_WIDGET_NOT_FOUND = 'ERR_WIDGET_NOT_FOUND',
  ERR_SHARED_DASHBOARD_PASSWORD_INVALID = 'ERR_SHARED_DASHBOARD_PASSWORD_INVALID',
  ERR_DUPLICATE_IN_ALIAS = 'ERR_DUPLICATE_IN_ALIAS',
  ERR_OUT_OF_SYNC = 'ERR_OUT_OF_SYNC',
  ERR_FILTER_VERIFICATION_FAILED = 'ERR_FILTER_VERIFICATION_FAILED',
  ERR_VIEW_COLUMN_NOT_FOUND = 'ERR_VIEW_COLUMN_NOT_FOUND',
  ERR_WEBHOOK_ERROR = 'ERR_WEBHOOK_ERROR',
  ERR_WEBHOOK_URL_INVALID = 'ERR_WEBHOOK_URL_INVALID',
  ERR_BASE_OP_FAILED = 'ERR_BASE_OP_FAILED',
  ERR_TABLE_OP_FAILED = 'ERR_TABLE_OP_FAILED',
  ERR_COLUMN_OP_FAILED = 'ERR_COLUMN_OP_FAILED',
  ERR_DATA_SOURCES_NOT_FOUND = 'ERR_DATA_SOURCES_NOT_FOUND',
  ERR_TEST_PLUGIN_FAILED = 'ERR_TEST_PLUGIN_FAILED',
  ERR_UNSUPPORTED_RELATION = 'ERR_UNSUPPORTED_RELATION',
  ERR_IN_EXTERNAL_DATA_SOURCE = 'ERR_IN_EXTERNAL_DATA_SOURCE',
  ERR_EXTERNAL_DATA_SOURCE_TIMEOUT = 'ERR_EXTERNAL_DATA_SOURCE_TIMEOUT',
  ERR_RELATION_FIELD_NOT_FOUND = 'ERR_RELATION_FIELD_NOT_FOUND',
  ERR_UNSUPPORTED_FILTER_OPERATION = 'ERR_UNSUPPORTED_FILTER_OPERATION',
  ERR_STORAGE_FILE_CREATE = 'ERR_STORAGE_FILE_CREATE',
  ERR_STORAGE_FILE_READ = 'ERR_STORAGE_FILE_READ',
  ERR_STORAGE_FILE_DELETE = 'ERR_STORAGE_FILE_DELETE',
  ERR_STORAGE_FILE_STREAM = 'ERR_STORAGE_FILE_STREAM',
  ERR_PLAN_ALREADY_EXISTS = 'ERR_PLAN_ALREADY_EXISTS',
  ERR_SUBSCRIPTION_ALREADY_EXISTS = 'ERR_SUBSCRIPTION_ALREADY_EXISTS',
  ERR_SUBSCRIPTION_NOT_FOUND = 'ERR_SUBSCRIPTION_NOT_FOUND',
  ERR_PLAN_NOT_AVAILABLE = 'ERR_PLAN_NOT_AVAILABLE',
  ERR_SEAT_COUNT_MISMATCH = 'ERR_SEAT_COUNT_MISMATCH',
  ERR_INVALID_PAYMENT_PAYLOAD = 'ERR_INVALID_PAYMENT_PAYLOAD',
  ERR_STRIPE_CUSTOMER_NOT_FOUND = 'ERR_STRIPE_CUSTOMER_NOT_FOUND',
  ERR_STRIPE_SUBSCRIPTION_NOT_FOUND = 'ERR_STRIPE_SUBSCRIPTION_NOT_FOUND',
  ERR_SUBSCRIPTION_OWNERSHIP_MISMATCH = 'ERR_SUBSCRIPTION_OWNERSHIP_MISMATCH',
  ERR_INTERNAL_CUSTOMER_NOT_SUPPORTED = 'ERR_INTERNAL_CUSTOMER_NOT_SUPPORTED',
  ERR_SUBSCRIPTION_CREATE_FAILED = 'ERR_SUBSCRIPTION_CREATE_FAILED',
  ERR_STRIPE_WEBHOOK_VERIFICATION_FAILED = 'ERR_STRIPE_WEBHOOK_VERIFICATION_FAILED',
}

export enum ROW_COLORING_MODE {
  FILTER = 'filter',
  SELECT = 'select',
}

export const LongTextAiMetaProp = 'ai';

export const NO_SCOPE = 'nc';

export const NON_SEAT_ROLES = [
  WorkspaceUserRoles.NO_ACCESS,
  WorkspaceUserRoles.VIEWER,
  WorkspaceUserRoles.COMMENTER,
  ProjectRoles.NO_ACCESS,
  ProjectRoles.VIEWER,
  ProjectRoles.COMMENTER,
];

export const DURATION_TYPE_MAP = {
  0: 'h:mm',
  1: 'h:mm:ss',
  2: 'h:mm:ss.s',
  3: 'h:mm:ss.ss',
  4: 'h:mm:ss.sss',
  'h:mm': 0,
  'h:mm:ss': 1,
  'h:mm:ss.s': 2,
  'h:mm:ss.ss': 3,
  'h:mm:ss.sss': 4,
};

export const CURRENT_USER_TOKEN = '@me';

// this type makes every parameter inside an object be optional
// useful for where / insert / update query
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

export type RowColoringInfoFilterRow = {
  id: string;
  is_set_as_background: boolean;
  nc_order: number;
  color: string;
  conditions: FilterType[];
  nestedConditions: FilterType[];
};

export type RowColoringInfoSelect = {
  mode: ROW_COLORING_MODE.SELECT;
  fk_column_id: string;
  options: { title: string; color: string }[];
  selectColumn: ColumnType;
  is_set_as_background: boolean;
};
export type RowColoringInfoFilter = {
  mode: ROW_COLORING_MODE.FILTER;
  conditions: RowColoringInfoFilterRow[];
};

export type RowColoringInfo = {
  fk_model_id: string;
  fk_view_id: string;
} & (RowColoringInfoSelect | RowColoringInfoFilter);

type Roles = OrgUserRoles | ProjectRoles | WorkspaceUserRoles;

type RolesObj = Partial<Record<Roles, boolean>>;

type RolesType = RolesObj | string[] | string;

interface PlanLimitExceededDetailsType {
  plan?: PlanTitles;
  limit?: number;
  current?: number;
  higherPlan?: PlanTitles;
}

export { Roles, RolesObj, RolesType, PlanLimitExceededDetailsType };

export type RowColoringMode = null | 'SELECT' | 'FILTER';

export enum RowHeight {
  SHORT = 0,
  MEDIUM = 1,
  TALL = 2,
  EXTRA = 3,
}

export const RowHeightMap = {
  short: RowHeight.SHORT,
  medium: RowHeight.MEDIUM,
  tall: RowHeight.TALL,
  extra: RowHeight.EXTRA,
  [RowHeight.SHORT]: 'short',
  [RowHeight.MEDIUM]: 'medium',
  [RowHeight.TALL]: 'tall',
  [RowHeight.EXTRA]: 'extra',
};
