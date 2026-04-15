import type { ViewType } from 'nocodb-sdk'
import { ViewLockType } from 'nocodb-sdk'
import type { Ref } from 'vue'

/**
 * Shared composable for personal-view / locked-view permission checks.
 * Combines the user's role-based ACL with per-view ownership + lock_type rules.
 */
export function usePersonalViewPermissions(view: Ref<ViewType | undefined>) {
  const { isUIAllowed } = useRoles()
  const { user } = useGlobal()

  const isPersonalView = computed(() => view.value?.lock_type === ViewLockType.Personal)
  const isLockedView = computed(() => view.value?.lock_type === ViewLockType.Locked)

  // Personal-view ownership is strictly `owned_by === current user`.
  // We intentionally don't use the store's `isUserViewOwner` here because it
  // also treats the original `created_by` as owner — which is correct for
  // collaborative views (no owned_by) but wrong for personal views that have
  // been reassigned to someone else. Backend enforces the strict check; the
  // frontend must mirror it to avoid showing enabled controls that 403.
  const isPersonalViewOwner = computed(
    () => isPersonalView.value && !!view.value?.owned_by && view.value.owned_by === user.value?.id,
  )

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
   * Whether the current user can act on this view's definition
   * (rename, change icon, change lock_type, edit description, delete).
   *
   * - Base editors have `viewCreateOrEdit` but cannot touch locked views
   *   or personal views they don't own.
   * - Creator+ (proxied by `fieldAdd`) bypasses lock/ownership restrictions.
   *
   * Modify and delete currently share the same rules, so `canDeleteView` is
   * an alias. If the rules diverge later, split them.
   */
  const canModifyView = computed(() => {
    if (!isUIAllowed('viewCreateOrEdit')) return false

    // Locked views: only creator+ can modify.
    if (isLockedView.value && !isUIAllowed('fieldAdd')) return false

    // Personal views: only the owner or creator+ can modify.
    if (isPersonalView.value && !isPersonalViewOwner.value && !isUIAllowed('fieldAdd')) return false

    return true
  })

  const canDeleteView = canModifyView

  return {
    isPersonalView,
    isLockedView,
    isPersonalViewOwner,
    hasPersonalViewPermission,
    canModifyView,
    canDeleteView,
  }
}
