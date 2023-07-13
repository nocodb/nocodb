import type { FilterReqType, HookReqType, HookType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useWebhooksStore = defineStore('webhooksStore', () => {
  const hooks = ref<HookType[]>([])

  const { $api, $e } = useNuxtApp()
  const { t } = useI18n()

  async function loadHooksList() {
    const { activeTable } = useTablesStore()

    try {
      const hookList = (await $api.dbTableWebhook.list(activeTable?.id as string)).list

      hooks.value = hookList.map((hook) => {
        hook.notification = parseProp(hook.notification)
        return hook
      })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function deleteHook(id: string) {
    const index = hooks.value.findIndex((hook) => hook.id === id)

    try {
      if (id) {
        await $api.dbTableWebhook.delete(id)
        hooks.value.splice(index, 1)
      } else {
        hooks.value.splice(index, 1)
      }

      if (!hooks.value.length) {
        hooks.value = []
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function copyHook(hook: HookType) {
    try {
      const newHook = await $api.dbTableWebhook.create(hook.fk_model_id!, {
        ...hook,
        title: `${hook.title} - Copy`,
        active: false,
      } as HookReqType)

      if (newHook) {
        $e('a:webhook:copy')
        // create the corresponding filters
        const hookFilters = (await $api.dbTableWebhookFilter.read(hook.id!, {})).list
        for (const hookFilter of hookFilters) {
          await $api.dbTableWebhookFilter.create(newHook.id!, {
            comparison_op: hookFilter.comparison_op,
            comparison_sub_op: hookFilter.comparison_sub_op,
            fk_column_id: hookFilter.fk_column_id,
            fk_parent_id: hookFilter.fk_parent_id,
            is_group: hookFilter.is_group,
            logical_op: hookFilter.logical_op,
            value: hookFilter.value,
          } as FilterReqType)
        }
        newHook.notification = parseProp(newHook.notification)
        hooks.value = [newHook, ...hooks.value]
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  return {
    hooks,
    loadHooksList,
    deleteHook,
    copyHook,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWebhooksStore as any, import.meta.hot))
}
