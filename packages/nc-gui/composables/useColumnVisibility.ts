import type { ColumnType } from 'nocodb-sdk'

// Shared constant for role priority
export const ROLE_PRIORITY = ['owner', 'creator', 'editor', 'commenter', 'viewer'] as const

// Get user's highest role from their roles object
export const getUserHighestRole = (baseRoles: Record<string, boolean> | undefined): string => {
  if (!baseRoles) return 'viewer'
  const userRoles = Object.keys(baseRoles).filter((role) => baseRoles[role])
  return ROLE_PRIORITY.find((role) => userRoles.includes(role)) || 'viewer'
}

// Create column visibility composable
export const useColumnVisibility = () => {
  const { $api } = useNuxtApp()
  const { user: $user } = useGlobal()

  const columnVisibilityMap = ref<Record<string, any>>({})

  const loadColumnVisibility = async (tableId: string) => {
    if (!tableId) return
    try {
      const visibilityData = await $api.dbTableColumn.visibilityList(tableId)
      columnVisibilityMap.value = visibilityData.reduce<Record<string, any>>((acc, col) => {
        acc[col.id] = col
        return acc
      }, {})
    } catch (error) {
      console.warn('[ColumnVisibility] Error loading visibility data:', error)
      columnVisibilityMap.value = {}
    }
  }

  const isColumnHiddenForRole = (col: ColumnType, externalBaseRoles?: Record<string, boolean>): boolean => {
    const columnVisibility = columnVisibilityMap.value[col.id!]
    if (!columnVisibility?.disabled) return false

    const baseRoles = externalBaseRoles || $user.value?.base_roles
    const userRole = getUserHighestRole(baseRoles)

    return !!columnVisibility.disabled[userRole]
  }

  const filterVisibleColumns = <T extends ColumnType>(columns: T[], externalBaseRoles?: Record<string, boolean>): T[] => {
    return columns.filter((col) => !isColumnHiddenForRole(col, externalBaseRoles))
  }

  return {
    columnVisibilityMap,
    loadColumnVisibility,
    isColumnHiddenForRole,
    filterVisibleColumns,
  }
}
