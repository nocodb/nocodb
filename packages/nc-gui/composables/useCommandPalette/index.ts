import type { NinjaKeys } from 'ninja-keys'
import type { Ref } from 'vue'
import { homeCommands } from './commands'

interface CmdAction {
  id: string
  title: string
  hotkey?: string
  parent?: string
  children?: string[]
  handler?: Function
  icon?: string
  keywords?: string[]
  section?: string
}

export const useCommandPalette = createSharedComposable(() => {
  const cmdPalette = ref<NinjaKeys>()

  const { $api } = useNuxtApp()

  const refreshCommandPalette = createEventHook<void>()

  const lastScope: Ref<{ scope: string; data?: any }> = ref({ scope: 'workspace' })

  const cmdLoading = ref(false)

  function cmdOnSelected(event: any) {
    console.log('selected', event.detail)
  }

  function cmdOnChange(event: any) {
    console.log('change', event.detail)
  }

  const cmdPlaceholder = ref('Quick actions')

  const commands = ref<Record<string, CmdAction[]>>({
    homeCommands,
    projectCommands: [],
  })

  const staticData = computed(() => {
    const rtData = commands.value.homeCommands

    if (lastScope.value.scope === 'workspace') return rtData

    if (lastScope.value.scope === 'project') {
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
    if (lastScope.value.scope === 'workspace') return ''
    return lastScope.value.scope
  })

  async function loadScope(scope = 'workspace', data?: any) {
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
        console.log(cmdData.value)
      })
      .catch(() => (cmdLoading.value = false))
  }

  refreshCommandPalette.on(() => {
    loadScope(lastScope.value.scope, lastScope.value?.data)
  })

  return {
    cmdPalette,
    cmdData,
    activeScope,
    loadScope,
    cmdPlaceholder,
    cmdOnSelected,
    cmdOnChange,
    refreshCommandPalette: refreshCommandPalette.trigger,
  }
})
