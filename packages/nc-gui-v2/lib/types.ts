import type { Role } from './enums'

export interface User {
  id: string
  email: string
  firstname: string | null
  lastname: string | null
  roles: Roles
}

export interface FeedbackForm {
  url: string
  createdAt: string
  isHidden: boolean
  lastFormPollDate?: string
}

export type Roles = Record<Role, boolean>
