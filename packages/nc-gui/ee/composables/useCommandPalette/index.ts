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

  const cmdPlaceholder = ref('Quick Actions')

  const commands = ref({
    homeCommands,
    projectCommands: [],
  } as Record<string, CmdAction[]>)

  const staticData = computed(() => {
    const rtData = commands.value.homeCommands

    if (activeScope.value.scope === 'root') return rtData

    if (activeScope.value.scope.startsWith('ws-')) {
      rtData.push(...commands.value.projectCommands)
    }

    return rtData
  })

  const dynamicData = ref<any>([])

  const tempData = ref<any>([])

  const loadedTemporaryScopes = ref<any>([])

  const cmdData = computed(() => {
    if (cmdLoading.value) {
      return [{ id: 'loading', title: 'Loading...' }, ...staticData.value]
    } else {
      return [...dynamicData.value, ...staticData.value, ...tempData.value]
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

  async function loadTemporaryScope(scope: { scope: string; data: any }) {
    if (loadedTemporaryScopes.value.find((s: any) => s.scope === scope.scope)) return

    if (
      activeScope.value.scope === scope.scope &&
      Object.keys(scope.data).every((k) => activeScope.value.data[k] && scope.data[k] === activeScope.value.data[k])
    )
      return
    $api.utils.commandPalette(scope).then((res) => {
      const fetchData = res.map((item: any) => {
        if (item.handler) item.handler = processHandler(item.handler)
        return item
      })
      for (const d of fetchData) {
        const fnd = tempData.value.find((t: any) => t.id === d.id)
        if (fnd) {
          Object.assign(fnd, d)
        } else {
          tempData.value.push(d)
        }
      }
      loadedTemporaryScopes.value.push(scope)
    })
  }

  async function loadScope() {
    if (activeScope.value.scope === 'disabled') {
      activeScope.value = { scope: activeScope.value.scope, data: activeScope.value.data }
      return
    }
    dynamicData.value = []
    tempData.value = []
    loadedTemporaryScopes.value = []
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
      .catch((e) => {
        cmdLoading.value = false
        console.log(e)
      })
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
        } else if (route.value.params.typeOrId.startsWith('w')) {
          if (activeScope.value.data.workspace_id === route.value.params.typeOrId) return
          activeScope.value = {
            scope: `ws-${route.value.params.typeOrId}`,
            data: { workspace_id: route.value.params.typeOrId },
          }
          loadScope()
        }
      } else {
        if (route.value.path.startsWith('/account')) {
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
    loadTemporaryScope,
  }
})
