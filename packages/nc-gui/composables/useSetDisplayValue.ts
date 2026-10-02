export function useSetDisplayValue() {
  const { $api, $e } = useNuxtApp()

  const { t } = useI18n()

  const { getMeta } = useMetas()

  const { eventBus } = useSmartsheetStoreOrThrow()

  const meta = inject(MetaInj, ref())

  const reloadDataHook = inject(ReloadViewDataHookInj, undefined)

  const reloadRowTrigger = inject(ReloadRowDataHookInj, null)

  const setAsDisplayValue = async (columnId: string, source: 'menu' | 'drag' = 'menu') => {
    try {
      await $api.internal.postOperation(
        meta.value!.fk_workspace_id!,
        meta.value!.base_id!,
        {
          operation: 'columnSetAsPrimary',
          columnId,
        },
        {},
      )

      await getMeta(meta.value?.base_id as string, meta.value?.id as string, true)

      eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
      $e('a:column:set-primary', { source })

      // reload data since there might be some changes in the data if there is LTAR
      // or a formula field which refers to a LTAR field
      reloadDataHook?.trigger()

      // same way reload the row data if trigger is available
      reloadRowTrigger?.trigger()

      return true
    } catch (e) {
      message.error(t('msg.error.primaryColumnUpdateFailed'))
      return false
    }
  }

  return { setAsDisplayValue }
}
