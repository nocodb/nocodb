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
   * Whether the current user has a given view-config permission, taking
   * view type into account.
   *
   * - **Collab / own personal**: role ACL decides (editor has filterSync, etc.)
   * - **Non-owned personal**: only creator+ (`fieldAdd`) can act; editors denied
   *   even if they have the role perm — backend middleware rejects them.
   * - **Locked**: only creator+ can act.
   * - **Personal view owner**: always granted regardless of role perm (e.g. a
   *   commenter who owns a personal view can still edit it).
   *
   * This closes the trap where a raw `isUIAllowed(perm)` would return true
   * on any view because the role has it, but the backend would 403 on
   * non-owned-personal / locked views.
   */
  const hasPersonalViewPermission = (permission: string) => {
    return computed(() => {
      // Personal view, user is not the owner — only creator+ bypass
      if (isPersonalView.value && !isPersonalViewOwner.value) {
        return isUIAllowed('fieldAdd')
      }
      // Locked view — only creator+ can modify
      if (isLockedView.value) {
        return isUIAllowed('fieldAdd')
      }
      // Collab view or own personal — role ACL applies
      if (isUIAllowed(permission)) return true
      // Fallback: personal view owner always gets access
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
