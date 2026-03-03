import type { ViewType } from 'nocodb-sdk'
import { ViewLockType } from 'nocodb-sdk'
import type { Ref } from 'vue'

/**
 * Shared composable for personal view permission checks.
 * Checks if the current user has a given permission via role OR is the owner of a personal view.
 */
export function usePersonalViewPermissions(view: Ref<ViewType | undefined>) {
  const { isUIAllowed } = useRoles()
  const { isUserViewOwner } = useViewsStore()

  const isPersonalViewOwner = computed(() => view.value?.lock_type === ViewLockType.Personal && isUserViewOwner(view.value))

  /**
   * Returns a computed that is true if the user has the given permission via role
   * OR is the owner of a personal view.
   */
  const hasPersonalViewPermission = (permission: string) => {
    return computed(() => {
      if (isUIAllowed(permission)) return true
      if (isPersonalViewOwner.value) return true
      return false
    })
  }

  return { isPersonalViewOwner, hasPersonalViewPermission }
}
