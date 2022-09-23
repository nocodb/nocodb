import type { FilterType } from 'nocodb-sdk'
import type { I18n } from 'vue-i18n'
import type { Role } from './enums'

export interface User {
  id: string
  email: string
  firstname: string | null
  lastname: string | null
  roles: Roles
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

export type Roles = Record<Role | string, boolean> | string

export type Filter = FilterType & { status?: 'update' | 'delete' | 'create'; parentId?: string; readOnly?: boolean }

export type NocoI18n = I18n<{}, unknown, unknown, string, false>
