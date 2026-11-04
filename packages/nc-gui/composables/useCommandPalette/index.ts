import { ViewTypes, viewTypeAlias } from 'nocodb-sdk'
import { getI18n } from '~/plugins/a.i18n'
import type { CmdCommand, CmdIcon, CmdLevel, CmdProvider, CmdProviderState } from '~/lib/types'

interface CmdRegistration {
  level: CmdLevel
  read: () => CmdProviderState
  token: symbol
}

const registrations = shallowReactive(new Map<string, CmdRegistration>())

/** Commands registered by whatever is mounted; the Cmd+K palette reads them all. */
export function useCommandRegistry() {
  const providers = computed<CmdProvider[]>(() => [...registrations].map(([id, { level, read }]) => ({ id, level, ...read() })))

  function register(id: string, level: CmdLevel, read: () => CmdProviderState) {
    const token = Symbol(id)
    registrations.set(id, { level, read, token })

    return () => {
      // A newer mount may have taken the id; only remove our own registration.
      if (registrations.get(id)?.token === token) registrations.delete(id)
    }
  }

  return { providers, register }
}

/**
 * Registers commands for as long as the calling scope lives. `read` runs inside the
 * palette's computed, so the refs it touches keep the list reactive.
 */
export function useCommandProvider(id: MaybeRefOrGetter<string>, level: CmdLevel, read: () => CmdProviderState) {
  const { register } = useCommandRegistry()

  let unregister: (() => void) | undefined

  watch(
    () => toValue(id),
    (providerId) => {
      unregister?.()
      unregister = register(providerId, level, read)
    },
    { immediate: true },
  )

  tryOnScopeDispose(() => unregister?.())
}

interface NavItem {
  id: string
  title: string
  parent?: string
  icon?: string
  iconColor?: string
  section?: string
  projectName?: string
  synced?: boolean
  managed_app_master?: boolean
  managed_app_id?: string
  handler?: { type: string; payload: string }
}

// A function, not a module-level const: SDK enums read at module top level break the Rollup build.
function viewTypeByAlias(alias: string): ViewTypes | undefined {
  const entry = Object.entries(viewTypeAlias).find(([, value]) => value === alias)
  return entry ? (Number(entry[0]) as ViewTypes) : undefined
}

export const useCommandPalette = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const { t } = getI18n().global

  const router = useRouter()

  const route = router.currentRoute

  const { token } = useGlobal()

  const commandPalette = ref()

  const refreshCommandPalette = createEventHook<void>()

  const activeScope = ref<{ scope: string; data: Record<string, string> }>({ scope: 'disabled', data: {} })

  const cmdLoading = ref(false)

  const needRefresh = ref(true)

  const navItems = ref<NavItem[]>([])

  const sectionLabels = computed<Record<string, string>>(() => ({
    Bases: t('objects.projects'),
    Tables: t('objects.tables'),
    // Not "Views": it would read like the "View" actions section beside it.
    Views: t('labels.commandPalette.sections.goToView'),
  }))

  function navIcon(item: NavItem): CmdIcon | undefined {
    if (item.section === 'Bases' || item.icon === 'project') {
      return {
        type: 'base',
        color: item.iconColor,
        managedAppMaster: item.managed_app_master,
        managedAppId: item.managed_app_id,
      }
    }
    // The server sends a custom emoji, or else the table type / view type alias.
    if (item.section === 'Tables' || item.icon === 'table') {
      const isTypeName = !item.icon || item.icon === 'table' || item.icon === 'view'
      return { type: 'table', icon: isTypeName ? undefined : item.icon, synced: item.synced }
    }
    if (item.section === 'Views') {
      const viewType = viewTypeByAlias(item.icon ?? '')
      return viewType ? { type: 'view', viewType } : { type: 'view', viewType: ViewTypes.GRID, icon: item.icon }
    }
    if (!item.icon) return
    return { type: 'icon', name: item.icon }
  }

  /** Server tree as commands: leaves navigate, branches open their children. Search-only. */
  const navigationCommands = computed<CmdCommand[]>(() => {
    const byParent = new Map<string, NavItem[]>()
    for (const item of navItems.value) {
      if (!item.parent) continue
      if (!byParent.has(item.parent)) byParent.set(item.parent, [])
      byParent.get(item.parent)!.push(item)
    }

    const toCommand = (item: NavItem): CmdCommand => {
      const children = byParent.get(item.id)
      const payload = item.handler?.type === 'navigate' ? item.handler.payload : undefined

      return {
        id: item.id,
        title: item.title,
        section: item.section ? sectionLabels.value[item.section] ?? item.section : undefined,
        hint: item.projectName,
        icon: navIcon(item),
        searchOnly: true,
        run: payload ? () => navigateTo(payload) : undefined,
        children: !payload && children?.length ? () => children.map(toCommand) : undefined,
      }
    }

    return navItems.value.map(toCommand)
  })

  function navigationChildrenOf(id: string) {
    return navigationCommands.value.find((command) => command.id === id)?.children?.() ?? []
  }

  async function loadScope() {
    if (activeScope.value.scope === 'disabled' || !needRefresh.value) return

    needRefresh.value = false
    navItems.value = []
    cmdLoading.value = true

    try {
      navItems.value = await $api.utils.commandPalette(activeScope.value)
    } catch {
      needRefresh.value = true
    } finally {
      cmdLoading.value = false
    }
  }

  refreshCommandPalette.on(() => {
    navItems.value = []
    needRefresh.value = true
  })

  watch(
    () => route.value.params,
    () => {
      if (!token.value) return

      const typeOrId = route.value.params.typeOrId
      if (typeof typeOrId !== 'string') {
        activeScope.value = { scope: 'root', data: {} }
        return
      }

      if (typeOrId === 'base') {
        activeScope.value = { scope: 'disabled', data: {} }
      } else if (typeOrId.startsWith('w')) {
        if (activeScope.value.data.workspace_id === typeOrId) return

        activeScope.value = { scope: `ws-${typeOrId}`, data: { workspace_id: typeOrId } }
        refreshCommandPalette.trigger()
      } else if (typeOrId === 'nc') {
        const baseId = route.value.params.baseId
        if (typeof baseId !== 'string' || activeScope.value.data.base_id === baseId) return

        activeScope.value = { scope: `p-${baseId}`, data: { base_id: baseId } }
      } else if (activeScope.value.scope !== 'root') {
        activeScope.value = { scope: 'root', data: {} }
      }
    },
    { immediate: true, deep: true },
  )

  const openCommandPalette = () => {
    commandPalette.value?.open?.()
  }

  return {
    commandPalette,
    activeScope,
    loadScope,
    cmdLoading,
    navigationCommands,
    navigationChildrenOf,
    refreshCommandPalette: refreshCommandPalette.trigger,
    openCommandPalette,
  }
})
