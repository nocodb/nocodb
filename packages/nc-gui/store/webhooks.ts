import { pickFields } from 'nocodb-sdk'
import type { FilterReqType, FilterType, HookReqType, HookType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'

const HOOK_API_FIELDS = [
  'title',
  'description',
  'env',
  'event',
  'operation',
  'fk_model_id',
  'type',
  'async',
  'active',
  'condition',
  'trigger_field',
  'trigger_fields',
  'retries',
  'retry_interval',
  'timeout',
  'version',
  'url',
  'headers',
  'payload',
  'id',
] as const

export const useWebhooksStore = defineStore('webhooksStore', () => {
  const hooks = ref<HookType[]>([])

  const isHooksLoading = ref(true)

  const { $api, $e } = useNuxtApp()

  const { getMeta } = useMetas()
  const { activeTable } = toRefs(useTablesStore())

  const hasV2Webhooks = computed(() => {
    return hooks.value.some((hook) => hook.version === 'v2')
  })

  async function loadHooksList() {
    isHooksLoading.value = true
    try {
      const hookList = (
        await $api.internal.getOperation(activeTable.value!.fk_workspace_id!, activeTable.value!.base_id!, {
          operation: 'hookList',
          tableId: activeTable.value?.id as string,
        })
      ).list

      hooks.value = hookList.map((hook) => {
        hook.notification = parseProp(hook.notification)
        return hook
      })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isHooksLoading.value = false
    }
  }

  async function deleteHook(id: string) {
    const index = hooks.value.findIndex((hook) => hook.id === id)

    try {
      if (id) {
        await $api.internal.postOperation(
          activeTable.value!.fk_workspace_id!,
          activeTable.value!.base_id!,
          {
            operation: 'hookDelete',
            hookId: id,
          },
          {},
        )
        hooks.value.splice(index, 1)
      } else {
        hooks.value.splice(index, 1)
      }

      if (!hooks.value.length) {
        hooks.value = []
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      await getMeta(activeTable.value.base_id!, activeTable.value.id!, true)
    }
  }

  async function copyHook(hook: HookType) {
    try {
      const fetchSubtree = async (filter: FilterType): Promise<any> => {
        const stripId = ({ id: _id, ...rest }: any) => rest
        if (!filter.is_group || !filter.id) {
          return stripId(filter)
        }
        const childList = (
          await $api.internal.getOperation(activeTable.value!.fk_workspace_id!, activeTable.value!.base_id!, {
            operation: 'filterChildrenList',
            filterId: filter.id,
          })
        ).list as FilterType[]
        const children = await Promise.all(childList.map(fetchSubtree))
        return { ...stripId(filter), children }
      }

      const sourceRoots = (
        await $api.internal.getOperation(activeTable.value!.fk_workspace_id!, activeTable.value!.base_id!, {
          operation: 'hookFilterList',
          hookId: hook.id!,
        })
      ).list as FilterType[]
      const filters = await Promise.all(sourceRoots.map(fetchSubtree))

      const newHook = await $api.internal.postOperation(
        activeTable.value!.fk_workspace_id!,
        activeTable.value!.base_id!,
        {
          operation: 'hookCreate',
          tableId: hook.fk_model_id!,
        },
        {
          ...pickFields(hook, HOOK_API_FIELDS as unknown as readonly (keyof typeof hook)[]),
          id: undefined,
          trigger_field: !!hook.trigger_field,
          title: generateUniqueTitle(`${hook.title} copy`, hooks.value, 'title', '_', true),
          active: hook.event === 'manual',
          ...(filters.length ? { filters } : {}),
        } as HookReqType,
      )

      if (newHook) {
        $e('a:webhook:copy')
        newHook.notification = parseProp(newHook.notification)
        hooks.value = [newHook, ...hooks.value]
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      await getMeta(activeTable.value.base_id!, activeTable.value.id!, true)
    }
  }

  async function saveHooks({
    hook: _hook,
    ogHook,
    filters,
  }: {
    hook: HookType
    ogHook: HookType
    filters?: Array<FilterReqType | FilterType>
  }) {
    if (!activeTable.value) throw new Error('activeTable is not defined')

    _hook.trigger_field = !!_hook.trigger_field

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
        res = await $api.internal.postOperation(
          activeTable.value!.fk_workspace_id!,
          activeTable.value!.base_id!,
          {
            operation: 'hookUpdate',
            hookId: hook.id,
          },
          {
            ...pickFields(hook, HOOK_API_FIELDS as unknown as readonly (keyof typeof hook)[]),
            notification: {
              ...hook.notification,
              payload: hook.notification.payload,
            },
            ...(filters !== undefined ? { filters } : {}),
          },
        )
      } else {
        res = await $api.internal.postOperation(
          activeTable.value!.fk_workspace_id!,
          activeTable.value!.base_id!,
          {
            operation: 'hookCreate',
            tableId: activeTable.value!.id!,
          },
          {
            ...pickFields(hook, HOOK_API_FIELDS as unknown as readonly (keyof typeof hook)[]),
            notification: {
              ...hook.notification,
              payload: hook.notification.payload,
            },
            ...(filters !== undefined ? { filters } : {}),
          } as HookReqType,
        )

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

      if (ogHook) {
        hooks.value = hooks.value.map((h) => {
          if (h.id === ogHook.id) {
            return ogHook
          }
          return h
        })
      }
    } finally {
      await getMeta(activeTable.value.base_id!, activeTable.value.id!, true)
    }

    $e('a:webhook:add', {
      operation: hook.operation,
      condition: hook.condition,
      notification: hook.notification.type,
    })

    return hook
  }

  // Used for deep-linking to a specific webhook from email notifications
  const pendingDeepLinkHookId = ref<string | null>(null)
  const pendingDeepLinkHookTab = ref<string | null>(null)

  return {
    hooks,
    loadHooksList,
    deleteHook,
    copyHook,
    saveHooks,
    isHooksLoading,
    hasV2Webhooks,
    pendingDeepLinkHookId,
    pendingDeepLinkHookTab,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWebhooksStore as any, import.meta.hot))
}
