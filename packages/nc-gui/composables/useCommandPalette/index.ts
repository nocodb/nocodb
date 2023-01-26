import type { NinjaKeys } from 'ninja-keys'
import { workspaceCommands } from './commands'

export const useCommandPalette = createSharedComposable(() => {
  const cmdPalette = ref<NinjaKeys>()

  const { $api } = useNuxtApp()

  const lastScope = ref('workspace')

  const cmdLoading = ref(false)

  function cmdOnSelected(event: any) {
    console.log('selected', event.detail)
  }

  function cmdOnChange(event: any) {
    console.log('change', event.detail)
  }

  const cmdPlaceholder = ref('Quick actions')

  const staticData = computed(() => {
    switch (lastScope.value) {
      case 'workspace':
      case 'project':
      default:
        return workspaceCommands
    }
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

  async function loadScope(scope: string, data?: any) {
    dynamicData.value = []
    cmdLoading.value = true
    lastScope.value = scope
    $api.utils
      .commandPalette({ scope, data })
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

  return { cmdPalette, cmdData, loadScope, cmdPlaceholder, cmdOnSelected, cmdOnChange }
})
