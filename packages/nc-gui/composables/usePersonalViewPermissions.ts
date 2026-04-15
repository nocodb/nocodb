import type { ViewType } from 'nocodb-sdk'
import { ViewLockType } from 'nocodb-sdk'
import type { Ref } from 'vue'

/**
 * Shared composable for personal-view / locked-view permission checks.
 * Combines the user's role-based ACL with per-view ownership + lock_type rules.
 */
export function usePersonalViewPermissions(view: Ref<ViewType | undefined>) {
  const { isUIAllowed } = useRoles()
  const { isUserViewOwner } = useViewsStore()

  const isPersonalView = computed(() => view.value?.lock_type === ViewLockType.Personal)
  const isLockedView = computed(() => view.value?.lock_type === ViewLockType.Locked)

  const isPersonalViewOwner = computed(() => isPersonalView.value && isUserViewOwner(view.value))

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

  /**
   * Whether the current user can modify this view's definition
   * (rename, change icon, change lock_type, edit description, etc.).
   *
   * - Base editors have `viewCreateOrEdit` but cannot modify locked views
   *   or personal views they don't own.
   * - Creator+ (proxied by `fieldAdd`) bypasses lock/ownership restrictions.
   */
  const canModifyView = computed(() => {
    if (!isUIAllowed('viewCreateOrEdit')) return false

    // Locked views: only creator+ can modify.
    if (isLockedView.value && !isUIAllowed('fieldAdd')) return false

    // Personal views: only the owner or creator+ can modify.
    if (isPersonalView.value && !isPersonalViewOwner.value && !isUIAllowed('fieldAdd')) return false

    return true
  })

  /**
   * Whether the current user can delete this view.
   *
   * - Base editors can delete any collaborative view and their own personal views.
   * - Creator+ can delete any view, including locked and others' personal views.
   */
  const canDeleteView = computed(() => {
    if (!isUIAllowed('viewCreateOrEdit')) return false

    // Locked views: only creator+ can delete.
    if (isLockedView.value && !isUIAllowed('fieldAdd')) return false

    // Personal views: only the owner or creator+ can delete.
    if (isPersonalView.value && !isPersonalViewOwner.value && !isUIAllowed('fieldAdd')) return false

    return true
  })

  return {
    isPersonalView,
    isLockedView,
    isPersonalViewOwner,
    hasPersonalViewPermission,
    canModifyView,
    canDeleteView,
  }
}
