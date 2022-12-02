import type { FilterType, ViewTypes } from 'nocodb-sdk'
import type { I18n } from 'vue-i18n'
import type { Theme as AntTheme } from 'ant-design-vue/es/config-provider'
import type { UploadFile } from 'ant-design-vue'
import type { ProjectRole, Role, TabType } from './enums'
import type { rolePermissions } from './constants'

export interface User {
  id: string
  email: string
  firstname: string | null
  lastname: string | null
  roles: Roles | string
  invite_token?: string
  project_id?: string
}

export interface ProjectMetaInfo {
  Node?: string
  Arch?: string
  Platform?: string
  Docker?: boolean
  Database?: string
  ProjectOnRootDB?: string
  RootDB?: string
  PackageVersion?: string
}

export interface Field {
  order: number
  show: number | boolean
  title: string
  fk_column_id?: string
  system?: boolean
}

export type Roles<T extends Role | ProjectRole = Role | ProjectRole> = Record<T | string, boolean>

export type Filter = FilterType & {
  field?: string
  status?: 'update' | 'delete' | 'create'
  parentId?: string
  readOnly?: boolean
}

export type NocoI18n = I18n<{}, unknown, unknown, string, false>

export interface ThemeConfig extends AntTheme {
  primaryColor: string
  accentColor: string
}

export interface Row {
  row: Record<string, any>
  oldRow: Record<string, any>
  rowMeta: {
    new?: boolean
    selected?: boolean
    commentCount?: number
    changed?: boolean
    saving?: boolean
  }
}

type RolePermissions = Omit<typeof rolePermissions, 'guest' | 'admin' | 'super'>

type GetKeys<T> = T extends Record<any, Record<infer Key, boolean>> ? Key : never

export type Permission<K extends keyof RolePermissions = keyof RolePermissions> = RolePermissions[K] extends Record<any, any>
  ? GetKeys<RolePermissions[K]>
  : never

export interface TabItem {
  type: TabType
  title: string
  id?: string
  viewTitle?: string
  viewId?: string
  sortsState?: Map<string, any>
  filterState?: Map<string, any>
}

export interface SharedViewMeta extends Record<string, any> {
  surveyMode?: boolean
  transitionDuration?: number // in ms
  withTheme?: boolean
  theme?: Partial<ThemeConfig>
  allowCSVDownload?: boolean
  rtl?: boolean
}

export interface SharedView {
  uuid?: string
  id: string
  password?: string
  type?: ViewTypes
  meta: SharedViewMeta
}

export type importFileList = (UploadFile & { data: string | ArrayBuffer })[]

export type streamImportFileList = UploadFile[]
