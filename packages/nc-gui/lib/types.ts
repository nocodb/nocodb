import type { FilterType } from 'nocodb-sdk'
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

export type Roles = Record<Role, boolean>

export type Filter = FilterType & { status?: 'update' | 'delete' | 'create'; parentId?: string; readOnly?: boolean }
