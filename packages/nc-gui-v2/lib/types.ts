import type { ComputedRef, ToRefs } from 'vue'
import type { Roles } from '~/lib/enums'

export interface User {
  id: string
  email: string
  firstname: string | null
  lastname: string | null
  roles: Roles
}

export interface StoredState {
  token: string | null
  user: User | null
  lang: string
  darkMode: boolean
}

export interface State extends StoredState {
  sidebarOpen: boolean
}

export interface Getters {
  signedIn: ComputedRef<boolean>
}

export interface Actions {
  signOut: () => void
  signIn: (token: string) => void
}

export type ReadonlyState = Readonly<Pick<State, 'token' | 'user'>> & Omit<State, 'token' | 'user'>

export type GlobalState = Getters & Actions & ToRefs<ReadonlyState>

export type ClientType = 'mysql2' | 'mssql' | 'pg' | 'sqlite3' | 'vitess'

export interface ProjectCreateForm {
  title: string
  dataSource: {
    client: ClientType
    connection:
      | {
          host: string
          database: string
          user: string
          password: string
          port: number | string
          ssl?: Record<string, string>
          searchPath?: string[]
        }
      | {
          client?: 'sqlite3'
          database: string
          connection?: {
            filename?: string
          }
          useNullAsDefault?: boolean
        }
  }
  inflection: {
    inflection_column?: string
    inflection_table?: string
  }
}
