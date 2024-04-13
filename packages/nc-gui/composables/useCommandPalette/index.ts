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
  projectName?: string
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

  const cmdPlaceholder = ref('Search workspace, bases, tables, views & more...')

  const { token, user, signOut } = useGlobal()

  const commands = ref({
    homeCommands,
    baseCommands: [],
  } as Record<string, CmdAction[]>)

  const staticData = computed(() => {
    const staticCmd = commands.value.homeCommands

    // Static Commands
    staticCmd.map((cmd) => {
      if (cmd.id === 'user') {
        if (user.value && user.value.display_name && user.value.email) {
          cmd.title = user.value.display_name ?? user.value.email.split('@')[0] ?? 'User'
        }
      } else if (cmd.id === 'user_account-logout') {
        cmd.handler = async () => {
          await signOut()
          window.location.reload()
        }
      }
      return cmd
    })

    if (activeScope.value.scope === 'root') return staticCmd

    staticCmd.push(...commands.value.baseCommands)

    return staticCmd
  })

  const dynamicData = ref<any>([])

  const tempData = ref<any>([])

  const loadedTemporaryScopes = ref<any>([])

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
      // if user is not authenticated, don't load scope
      if (!token.value) return

      if (route.value.params.typeOrId && typeof route.value.params.typeOrId === 'string') {
        if (route.value.params.typeOrId === 'base') {
          if (activeScope.value.scope === 'disabled') return

          activeScope.value = { scope: 'disabled', data: {} }

          loadScope()
        } else if (route.value.params.typeOrId.startsWith('w')) {
          if (activeScope.value.data?.workspace_id === route.value.params.typeOrId) return

          activeScope.value = {
            scope: `ws-${route.value.params.typeOrId}`,
            data: { workspace_id: route.value.params.typeOrId },
          }

          loadScope()
        } else if (route.value.params.typeOrId === 'nc') {
          if (activeScope.value.data.base_id === route.value.params.baseId) return

          activeScope.value = {
            scope: `p-${route.value.params.baseId}`,
            data: { base_id: route.value.params.baseId },
          }
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
