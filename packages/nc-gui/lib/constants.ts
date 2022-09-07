export const NOCO = 'noco'
export const USER_PROJECT_ROLES = 'user_project_roles'
export const SYSTEM_COLUMNS = ['id', 'title', 'created_at', 'updated_at']
export const BASE_URL = process.env.NC_BACKEND_URL || (process.env.NODE_ENV === 'production' ? '..' : 'http://localhost:8080')
