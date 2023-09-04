import type { Ref } from 'vue'
import { homeCommands } from './commands'

interface CmdAction {
  id: string
  title: string
  hotkey?: string
  parent?: string
  handler?: Function
  icon?: VNode | string
  keywords?: string[]
  section?: string
}

export const useCommandPalette = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const router = useRouter()

  const route = router.currentRoute

  const commandPalette = ref()

  const refreshCommandPalette = createEventHook<void>()

  const activeScope: Ref<{ scope: string; data: any }> = ref({ scope: 'disabled', data: {} })

  const cmdLoading = ref(false)

  const cmdPlaceholder = ref('Quick actions')

  const commands = ref({
    homeCommands,
    projectCommands: [],
  } as Record<string, CmdAction[]>)

  const staticData = computed(() => {
    const rtData = commands.value.homeCommands

    if (activeScope.value.scope === 'root') return rtData

    if (activeScope.value.scope === 'workspace') {
      rtData.push(...commands.value.projectCommands)
    }

    return rtData
  })

  const dynamicData = ref([])

  const cmdData = computed(() => {
    if (cmdLoading.value) {
      return [{ id: 'loading', title: 'Loading...' }, ...staticData.value]
    } else {
      return [...dynamicData.value, ...staticData.value]
    }
  })

  function processHandler(handler: { type: string; payload: string }) {
    switch (handler.type) {
      case 'navigate':
        return () => navigateTo(handler.payload)
      default:
        break
    }
  }

  async function loadScope() {
    if (activeScope.value.scope === 'disabled') {
      activeScope.value = { scope: activeScope.value.scope, data: activeScope.value.data }
      return
    }
    dynamicData.value = []
    cmdLoading.value = true
    $api.utils
      .commandPalette(activeScope.value)
      .then((res) => {
        dynamicData.value = res.map((item: any) => {
          if (item.handler) item.handler = processHandler(item.handler)
          return item
        })
        cmdLoading.value = false
      })
      .catch(() => (cmdLoading.value = false))
  }

  refreshCommandPalette.on(() => {
    loadScope()
  })

  watch(
    () => route.value.params,
    () => {
      if (route.value.params.typeOrId && typeof route.value.params.typeOrId === 'string') {
        if (route.value.params.typeOrId === 'base') {
          if (activeScope.value.scope === 'disabled') return
          activeScope.value = { scope: 'disabled', data: {} }
          loadScope()
        } else if (route.value.params.typeOrId.startsWith('ws')) {
          if (activeScope.value.scope === 'workspace' && activeScope.value.data.workspace_id === route.value.params.typeOrId)
            return
          activeScope.value = {
            scope: 'workspace',
            data: { workspace_id: route.value.params.typeOrId },
          }
          loadScope()
        }
      } else {
        if (route.value.path === '/account/users') {
          if (activeScope.value.scope === 'account_settings') return
          activeScope.value = { scope: 'account_settings', data: {} }
          loadScope()
        } else {
          if (activeScope.value.scope === 'root') return
          activeScope.value = { scope: 'root', data: {} }
          loadScope()
        }
      }
    },
    { immediate: true, deep: true },
  )

  return {
    commandPalette,
    cmdData,
    activeScope,
    loadScope,
    cmdPlaceholder,
    refreshCommandPalette: refreshCommandPalette.trigger,
  }
})
