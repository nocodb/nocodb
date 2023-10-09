import type { BaseType, ColumnType, FilterType, MetaType, PaginatedType, Roles, RolesObj, ViewTypes } from 'nocodb-sdk'
import type { I18n } from 'vue-i18n'
import type { Theme as AntTheme } from 'ant-design-vue/es/config-provider'
import type { UploadFile } from 'ant-design-vue'
import type { ImportSource, ImportType, TabType } from './enums'
import type { rolePermissions } from './constants'

interface User {
  id: string
  email: string
  firstname: string | null
  lastname: string | null
  roles: RolesObj
  base_roles: RolesObj
  workspace_roles: RolesObj
  invite_token?: string
  base_id?: string
  display_name?: string | null
}

interface ProjectMetaInfo {
  Node?: string
  Arch?: string
  Platform?: string
  Docker?: boolean
  Database?: string
  ProjectOnRootDB?: boolean
  RootDB?: string
  PackageVersion?: string
}

interface Field {
  order: number
  show: number | boolean
  title: string
  fk_column_id?: string
  system?: boolean
  isViewEssentialField?: boolean
}

type Filter = FilterType & {
  field?: string
  status?: 'update' | 'delete' | 'create'
  parentId?: string
  readOnly?: boolean
}

type NocoI18n = I18n<{}, unknown, unknown, string, false>

interface ThemeConfig extends AntTheme {
  primaryColor: string
  accentColor: string
}

interface Row {
  row: Record<string, any>
  oldRow: Record<string, any>
  rowMeta: {
    new?: boolean
    selected?: boolean
    commentCount?: number
    changed?: boolean
    saving?: boolean
    // use in datetime picker component
    isUpdatedFromCopyNPaste?: Record<string, boolean>
  }
}

type RolePermissions = Omit<typeof rolePermissions, 'guest' | 'admin' | 'super'>

type GetKeys<T> = T extends Record<any, Record<infer Key, boolean>> ? Key : never

type Permission<K extends keyof RolePermissions = keyof RolePermissions> = RolePermissions[K] extends Record<any, any>
  ? GetKeys<RolePermissions[K]>
  : never

interface TabItem {
  type: TabType
  title: string
  id?: string
  viewTitle?: string
  viewId?: string
  sortsState?: Map<string, any>
  filterState?: Map<string, any>
  meta?: MetaType
  tabMeta?: any
  baseId?: string
}

interface SharedViewMeta extends Record<string, any> {
  surveyMode?: boolean
  transitionDuration?: number // in ms
  withTheme?: boolean
  theme?: Partial<ThemeConfig>
  allowCSVDownload?: boolean
  rtl?: boolean
}

interface SharedView {
  uuid?: string
  id: string
  password?: string
  type?: ViewTypes
  meta: SharedViewMeta
}

type importFileList = (UploadFile & { data: string | ArrayBuffer })[]

type streamImportFileList = UploadFile[]

type Nullable<T> = { [K in keyof T]: T[K] | null }

/**
 * @description: Base type for frontend
 */
type NcProject = BaseType & {
  /**
   * When base is expanded in sidebar
   * */
  isExpanded?: boolean
  /**
   * When base's content is being fetched i.e tables, views, etc
   */
  isLoading?: boolean
  temp_title?: string
  edit?: boolean
  starred?: boolean
  uuid?: string
}

interface UndoRedoAction {
  undo: { fn: Function; args: any[] }
  redo: { fn: Function; args: any[] }
  scope?: { key: string; param: string | string[] }[]
}

interface ImportWorkerPayload {
  importType: ImportType
  importSource: ImportSource
  value: any
  config: Record<string, any>
}

interface Group {
  key: string
  column: ColumnType
  color: string
  count: number
  nestedIn: GroupNestedIn[]
  paginationData: PaginatedType
  nested: boolean
  children?: Group[]
  rows?: Row[]
  root?: boolean
}

interface GroupNestedIn {
  title: string
  column_name: string
  key: string
  column_uidt: string
}

interface Users {
  emails?: string
  role: Roles
  invitationToken?: string
}

type ViewPageType = 'view' | 'webhook' | 'api' | 'field' | 'relation'

type NcButtonSize = 'xxsmall' | 'xsmall' | 'small' | 'medium'

export {
  User,
  ProjectMetaInfo,
  Field,
  Filter,
  NocoI18n,
  ThemeConfig,
  Row,
  RolePermissions,
  Permission,
  TabItem,
  SharedView,
  SharedViewMeta,
  importFileList,
  streamImportFileList,
  Nullable,
  NcProject,
  UndoRedoAction,
  ImportWorkerPayload,
  Group,
  GroupNestedIn,
  Users,
  ViewPageType,
  NcButtonSize,
}
