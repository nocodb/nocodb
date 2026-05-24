import type { ColumnType } from 'nocodb-sdk'

/**
 * Wraps a field-hide action with a warning modal when the column is a
 * "hide-blocking" required field — a real NOT NULL with no default, not a
 * system/virtual column. Hiding such a field means inline row create will
 * fail silently (#13838), so we ask the user to confirm and remind them
 * that rows added in this view will need the expanded form to fill the
 * required value.
 *
 * Usage at a toggle site:
 *
 *     const { confirmHide } = useHideRequiredFieldConfirm()
 *     confirmHide(field, () => { field.show = false; saveOrUpdate(...) })
 *
 * If the column isn't hide-blocking, `confirmHide` runs the action
 * immediately — call sites don't need to repeat the predicate.
 */
export function useHideRequiredFieldConfirm() {
  const { t } = useI18n()
  const { showWarningModal } = useNcConfirmModal()

  function confirmHide(column: ColumnType | undefined, onConfirm: () => void | Promise<void>) {
    if (!isHideBlockingRequired(column)) {
      const result = onConfirm()
      if (result instanceof Promise) {
        // Surface unhandled rejections so silent breakage is debuggable;
        // call sites that toast their own errors still get to do so via
        // their own try/catch around the awaited action.
        result.catch((e) => console.error('confirmHide: onConfirm rejected', e))
      }
      return
    }

    showWarningModal({
      title: t('msg.warning.hideRequiredField.title', { field: column!.title }),
      content: t('msg.warning.hideRequiredField.content'),
      okText: t('general.hide'),
      cancelText: t('general.cancel'),
      showCancelBtn: true,
      okCallback: async () => {
        await onConfirm()
      },
    })
  }

  return { confirmHide }
}
