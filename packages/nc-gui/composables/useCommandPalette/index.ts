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

  const refreshCommandPalette = createEventHook<void>()

  const lastScope: Ref<{ scope: string; data?: any }> = ref({ scope: 'root' })

  const cmdLoading = ref(false)

  const cmdPlaceholder = ref('Quick actions')

  const commands = ref({
    homeCommands,
    projectCommands: [],
  } as Record<string, CmdAction[]>)

  const staticData = computed(() => {
    const rtData = commands.value.homeCommands

    if (lastScope.value.scope === 'root') return rtData

    if (lastScope.value.scope === 'workspace') {
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

  const activeScope = computed(() => {
    return lastScope.value.scope
  })

  async function loadScope(scope = 'root', data?: any) {
    if (scope === 'disabled') {
      lastScope.value = { scope, data }
      return
    }
    dynamicData.value = []
    cmdLoading.value = true
    lastScope.value = { scope, data }
    $api.utils
      .commandPalette(lastScope.value)
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
    loadScope(lastScope.value.scope, lastScope.value?.data)
  })

  return {
    cmdData,
    activeScope,
    loadScope,
    cmdPlaceholder,
    refreshCommandPalette: refreshCommandPalette.trigger,
  }
})
