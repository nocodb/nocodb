import { PermissionOptionValue, PermissionOptions, getPermissionIcon, getPermissionLabel, getPermissionOption } from 'nocodb-sdk'

// Re-export the interface from SDK for backward compatibility
export type { PermissionOption } from 'nocodb-sdk'

export const usePermissions = () => {
  // Use centralized permission options from SDK
  const permissionOptions = PermissionOptions

  // Permissions data grouped by entity
  const permissionsByEntity = computed<Record<string, any[]>>(() => {
    return {}
  })

  const isTableAndFieldPermissionsEnabled = computed(() => false)

  // Get permission summary for an entity (returns internal value)
  const getPermissionSummary = (..._args: any[]) => {
    return PermissionOptionValue.EDITORS_AND_UP
  }

  // Get permission summary with display label
  const getPermissionSummaryLabel = (entity: string, entityId: string, permissionType: string) => {
    const internalValue = getPermissionSummary(entity, entityId, permissionType)
    return getPermissionLabel(internalValue)
  }

  const isAllowed = (..._args: any[]) => {
    return true
  }

  const getPermissionColor = (..._args: any[]): string => {
    return 'gray'
  }

  const getPermissionTextColor = (..._args: any[]): string => {
    return 'text-gray-700'
  }

  return {
    permissionOptions,
    permissionsByEntity,
    getPermissionOption,
    getPermissionLabel,
    getPermissionIcon,
    getPermissionColor,
    getPermissionTextColor,
    getPermissionSummary,
    getPermissionSummaryLabel,
    isAllowed,
    isTableAndFieldPermissionsEnabled,
  }
}
