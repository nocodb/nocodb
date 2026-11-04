import type { TableType, ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { DlgLockView } from '#components'
import { LockType } from '#imports'

export const lockTypeSwitchedMessage: Record<LockType, string> = {
  [LockType.Collaborative]: 'msg.toast.collabView',
  [LockType.Personal]: 'msg.toast.personalView',
  [LockType.Locked]: 'msg.toast.lockedView',
}

/** View-mode (collaborative / personal / locked) switching, shared by the view menu and Cmd+K. */
export function useViewLockType(
  view: Ref<ViewType | undefined>,
  table: Ref<TableType | undefined>,
  { onDone }: { onDone?: () => void } = {},
) {
  const { t } = useI18n()

  const { isUIAllowed } = useRoles()

  const { updateView } = useViewsStore()

  // Looked up by the target's own (baseId, tableId): the menu can open on a view of a
  // table other than the active one.
  const { viewsByTable } = storeToRefs(useViewsStore())

  const { isPersonalView, isLockedView, isPersonalViewOwner } = usePersonalViewPermissions(view)

  // Would converting/deleting this view leave the table with zero collab grid views?
  // Falls back to false while the list is empty or doesn't include the view yet.
  const isLastGridViewInTable = computed(() => {
    const baseId = table.value?.base_id
    const tableId = table.value?.id
    if (!baseId || !tableId) return false
    const viewsList = viewsByTable.value.get(`${baseId}:${tableId}`) || []
    if (viewsList.length === 0) return false
    if (!viewsList.some((v) => v.id === view.value?.id)) return false
    const otherNonPersonalGrids = viewsList.filter(
      (v) => v.id !== view.value?.id && v.type === ViewTypes.GRID && v.lock_type !== LockType.Personal,
    )
    return otherNonPersonalGrids.length === 0
  })

  const blockViewOperations = computed(() => {
    return isLastGridViewInTable.value && view.value?.type === ViewTypes.GRID
  })

  // Not owner of a personal view (and can't reassign), or locked + not creator+.
  const disableLockTypeMenu = computed(() => {
    if (isPersonalView.value && !isPersonalViewOwner.value && !isUIAllowed('reAssignViewOwner')) return true
    if (isLockedView.value && !isUIAllowed('fieldAdd')) return true
    return false
  })

  const disablePersonalView = computed(() => {
    // Default grid view can't be made personal (would leave the table without a grid view)
    if (blockViewOperations.value) return true

    // Converting someone else's personal view is not allowed (they're already personal anyway)
    if (isPersonalView.value && !isPersonalViewOwner.value) return true

    // Unlocking a locked view requires creator+
    if (isLockedView.value && !isUIAllowed('fieldAdd')) return true

    return false
  })

  const disableCollaborativeOption = computed(() => {
    // Locked → Collab = unlock, only creator+
    if (isLockedView.value) return !isUIAllowed('fieldAdd')

    // Personal → Collab, owner or creator+
    if (isPersonalView.value) return !isPersonalViewOwner.value && !isUIAllowed('reAssignViewOwner')

    return false
  })

  function onLockTypeChange(type: LockType) {
    const { close } = useDialog(DlgLockView, {
      'modelValue': ref(true),
      'onUpdate:modelValue': () => {
        close()
      },
      'changeType': type,
      view,
    })

    onDone?.()
  }

  /** `notify: false` (Cmd+K) skips the toasts and throws instead, so the caller reports inline. */
  async function changeLockType(type: LockType, { notify = true }: { notify?: boolean } = {}) {
    if (!view.value) return

    if (view.value?.lock_type === type) {
      if (notify) message.toast(t('msg.toast.alreadyInView', { type }))
      onDone?.()

      return
    }

    // if default view block the change since it's not allowed
    if (type === 'personal' && blockViewOperations.value) {
      if (!notify) throw new Error(t('msg.toast.notAllowedToChangeGridView'))
      return message.toast(t('msg.toast.notAllowedToChangeGridView'))
    }

    if (type === LockType.Locked || view.value.lock_type === LockType.Locked) {
      onLockTypeChange(type)

      return
    }

    try {
      view.value.lock_type = type

      await updateView(view.value?.id, {
        lock_type: type,
      })
      if (notify) message.toast(t(lockTypeSwitchedMessage[type]))
    } catch (e: unknown) {
      if (!notify) throw e
      message.toast(await extractSdkResponseErrorMsg(e as Error))
    }

    onDone?.()
  }

  return { blockViewOperations, disableLockTypeMenu, disablePersonalView, disableCollaborativeOption, changeLockType }
}
