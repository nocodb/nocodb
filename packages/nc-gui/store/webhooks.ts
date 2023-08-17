import type { FilterReqType, HookReqType, HookType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useWebhooksStore = defineStore('webhooksStore', () => {
  const hooks = ref<HookType[]>([])

  const { $api, $e } = useNuxtApp()

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

  async function saveHooks({ hook: _hook }: { hook: HookType }) {
    const { activeTable } = useTablesStore()
    if (!activeTable) throw new Error('activeTable is not defined')

    if (typeof _hook.notification === 'string') {
      _hook.notification = JSON.parse(_hook.notification)
    }
    let hook = _hook as Omit<HookType, 'notification'> & {
      notification: Record<string, any>
      eventOperation?: string
      condition: boolean
    }

    try {
      let res
      if (hook.id) {
        res = await $api.dbTableWebhook.update(hook.id, {
          ...hook,
          notification: {
            ...hook.notification,
            payload: hook.notification.payload,
          },
        })
      } else {
        res = await $api.dbTableWebhook.create(activeTable!.id!, {
          ...hook,
          notification: {
            ...hook.notification,
            payload: hook.notification.payload,
          },
        } as HookReqType)

        hooks.value.push(res)
      }

      if (res && typeof res.notification === 'string') {
        res.notification = JSON.parse(res.notification)
      }

      if (!hook.id && res) {
        hook = { ...hook, ...res } as any
      }

      // Webhook details updated successfully
      hooks.value = hooks.value.map((h) => {
        if (h.id === hook.id) {
          return hook
        }
        return h
      })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      console.error(e)
      throw e
    }

    $e('a:webhook:add', {
      operation: hook.operation,
      condition: hook.condition,
      notification: hook.notification.type,
    })

    return hook
  }

  const createHook = async (_hook?: HookType) => {
    const { activeTable } = useTablesStore()

    const emptyWebhook = {
      active: false,
      event: 'after',
      fk_model_id: activeTable?.id,
      title: 'New Webhook',
      operation: 'insert',
      version: 'v2',
      async: false,
      notification: {
        type: 'URL',
        payload: {
          method: 'POST',
          body: {},
          headers: [{}],
          parameters: [{}],
          path: '',
          auth: '',
        },
      },
      retry_interval: 60000,
      timeout: 60000,
      retries: 0,
      env: 'all',
    } as HookType

    return await saveHooks({ hook: _hook ?? emptyWebhook })
  }

  return {
    hooks,
    loadHooksList,
    deleteHook,
    copyHook,
    saveHooks,
    createHook,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWebhooksStore as any, import.meta.hot))
}
