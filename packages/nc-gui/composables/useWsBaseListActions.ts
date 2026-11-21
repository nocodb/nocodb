import type { SourceType } from 'nocodb-sdk'
import { DlgBaseErd } from '#components'

const [useProvideWsBaseListActions, useWsBaseListActions] = useInjectionState((closeModal: () => void) => {
  const basesStore = useBases()
  const { workspaceBasesMap, bases, isProjectsLoaded } = storeToRefs(basesStore)

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const { navigateToProject, getBaseUrl, ncNavigateTo } = useGlobal()
  const { $api, $e } = useNuxtApp()
  const route = useRoute()

  const { maybeNavigateToInterfaceOnlyBase } = useInterfacePermissions()

  const { baseCardAppCount, openBaseFromCard } = useAppsEntry()

  const { isAppInstall, navigateToApp } = useManagedAppInstalls()

  // Dialog state - consolidated into single reactive object
  const dialogState = reactive({
    duplicate: {
      isOpen: false,
      base: null as NcProject | null,
    },
    delete: {
      isOpen: false,
      base: null as NcProject | null,
    },
  })

  // Helper to update base in its workspace
  const updateBaseInWorkspace = (base: NcProject, updates: Partial<NcProject>) => {
    const workspaceId = base.fk_workspace_id!

    if (isEeUI) {
      const workspaceBases = workspaceBasesMap.value.get(workspaceId)
      if (workspaceBases && base.id) {
        const existingBase = workspaceBases.get(base.id)
        if (existingBase) {
          workspaceBases.set(base.id, { ...existingBase, ...updates })
        }
      }
    }

    if (!isEeUI || activeWorkspaceId.value === workspaceId) {
      bases.value.set(base.id!, { ...(bases.value.get(base.id!) || base), ...updates })
    }
  }

  // Actions
  const onRename = async (base: NcProject, title: string) => {
    try {
      updateBaseInWorkspace(base, { title })
      await $api.base.update(base.id!, { title })
      $e('a:base:rename')
    } catch (e: any) {
      updateBaseInWorkspace(base, { title: base.title })
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const onToggleStarred = async (base: NcProject) => {
    try {
      const newStarredState = !base.starred
      updateBaseInWorkspace(base, { starred: newStarredState })
      await $api.base.userMetaUpdate(
        base.id!,
        { starred: newStarredState },
        {
          baseURL: getBaseUrl(base.fk_workspace_id!) ?? undefined,
        },
      )
      $e('a:base:star:toggle')
    } catch (e: any) {
      updateBaseInWorkspace(base, { starred: base.starred })
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const onDuplicate = (base: NcProject) => {
    dialogState.duplicate.base = base
    dialogState.duplicate.isOpen = true
    $e('c:base:duplicate')
  }

  const onOpenErd = (base: NcProject, source: SourceType) => {
    $e('c:project:relation')

    const isOpen = ref(true)

    const { close } = useDialog(DlgBaseErd, {
      'modelValue': isOpen,
      'sourceId': source.id,
      'onUpdate:modelValue': () => closeDialog(),
      'baseId': base.id,
    })

    function closeDialog() {
      isOpen.value = false
      close(1000)
    }
  }

  const onOpenSettings = async (base: NcProject) => {
    closeModal()
    const workspaceId = base.fk_workspace_id || route.params.typeOrId
    await navigateTo(`/${workspaceId}/${base.id}/settings/settings`)
  }

  const onDelete = (base: NcProject) => {
    dialogState.delete.base = base
    dialogState.delete.isOpen = true
  }

  const onUpdateColor = async (base: NcProject, color: string) => {
    try {
      const newMeta = {
        ...parseProp(base.meta),
        iconColor: color,
      }
      updateBaseInWorkspace(base, { meta: newMeta as any })
      await $api.base.update(base.id!, { meta: JSON.stringify(newMeta) })
      $e('a:base:icon:color:modal', { iconColor: color })
    } catch (e: any) {
      updateBaseInWorkspace(base, { meta: base.meta })
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  // `null` clears the custom glyph so the base falls back to its default icon.
  const onUpdateIcon = async (base: NcProject, icon: string | null) => {
    try {
      const newMeta = {
        ...parseProp(base.meta),
        icon,
      }
      updateBaseInWorkspace(base, { meta: newMeta as any })
      await $api.base.update(base.id!, { meta: JSON.stringify(newMeta) })
      $e('a:base:icon:modal', { icon })
    } catch (e: any) {
      updateBaseInWorkspace(base, { meta: base.meta })
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const saveUserOrder = (base: NcProject, order: number) =>
    $api.base.userMetaUpdate(base.id!, { order }, { baseURL: getBaseUrl(base.fk_workspace_id!) ?? undefined })

  // Each user orders their own list; the order is built from where the base is dropped.
  const onReorder = async (base: NcProject, neighbours: { before?: NcProject; after?: NcProject }) => {
    const workspaceBases = isEeUI ? workspaceBasesMap.value.get(base.fk_workspace_id!) : bases.value
    const changes = computeBaseReorder([...(workspaceBases?.values() ?? [])], base, neighbours)
    const previous = new Map(changes.map(({ base: b }) => [b.id!, b.order]))

    changes.forEach(({ base: b, order }) => updateBaseInWorkspace(b, { order }))
    const results = await Promise.allSettled(changes.map(({ base: b, order }) => saveUserOrder(b, order)))

    // revert only what wasn't stored, so the list matches the server
    const failed = changes.filter((_, i) => results[i]?.status === 'rejected')
    failed.forEach(({ base: b }) => updateBaseInWorkspace(b, { order: previous.get(b.id!) }))

    if (failed.length) {
      const reason = (results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason
      message.error(await extractSdkResponseErrorMsg(reason))
    } else {
      $e('a:base:reorder')
    }
  }

  const onSelect = async (base: NcProject, { newTab = false }: { newTab?: boolean } = {}) => {
    // Prevent selecting bases in locked workspaces (CE mode, non-default)
    if (workspaceStore.isWorkspaceCeLocked(base.fk_workspace_id)) return

    $e('a:workspace:base:select')

    // Same target order as below, without touching the current tab.
    if (newTab) {
      if (isAppInstall(base)) return navigateToApp(base, { newTab })
      if (baseCardAppCount(base) > 0) return openBaseFromCard(base, { newTab })

      return ncNavigateTo({ workspaceId: base.fk_workspace_id!, baseId: base.id!, newTab })
    }

    closeModal()

    if (isEeUI && base.fk_workspace_id !== activeWorkspaceId.value) {
      isProjectsLoaded.value = false
    }

    // Grant-only collaborators (interface grants, no base/workspace role) go
    // straight to the interface consumer shell — the base route would 403.
    if (await maybeNavigateToInterfaceOnlyBase(base)) return

    // An install opens the app that was installed — that is the thing the user
    // added. Only a FULL-surface install offers "Go to data" (onOpenData) back
    // to the base under it.
    if (isAppInstall(base)) {
      navigateToApp(base)
      return
    }

    // A base with an app the user can open defaults to it — the card's "Go to
    // data" button (onOpenData) is the escape hatch to the data view.
    if (baseCardAppCount(base) > 0) {
      await openBaseFromCard(base)
      return
    }

    await navigateToProject({
      baseId: base.id!,
      workspaceId: base.fk_workspace_id!,
    })
  }

  /** Force-open the data view — the "Go to data" action on a card that opens an interface or an app. */
  const onOpenData = async (base: NcProject, { newTab = false }: { newTab?: boolean } = {}) => {
    if (workspaceStore.isWorkspaceCeLocked(base.fk_workspace_id)) return

    $e('a:workspace:base:open-data')

    if (newTab) return ncNavigateTo({ workspaceId: base.fk_workspace_id!, baseId: base.id!, newTab })

    closeModal()

    if (isEeUI && base.fk_workspace_id !== activeWorkspaceId.value) {
      isProjectsLoaded.value = false
    }

    await navigateToProject({
      baseId: base.id!,
      workspaceId: base.fk_workspace_id!,
    })
  }

  const switchWorkspace = async (workspaceId?: string) => {
    if (!workspaceId || activeWorkspaceId.value === workspaceId) return

    // Prevent navigating to locked workspaces (CE mode, non-default)
    if (workspaceStore.isWorkspaceCeLocked(workspaceId)) return

    $e('a:workspace:switch')

    closeModal()

    isProjectsLoaded.value = false

    navigateToProject({
      workspaceId,
    })
  }

  return {
    dialogState,
    onRename,
    onToggleStarred,
    onDuplicate,
    onOpenErd,
    onOpenSettings,
    onDelete,
    onUpdateColor,
    onUpdateIcon,
    onReorder,
    onSelect,
    onOpenData,
    closeModal,
    switchWorkspace,
  }
}, 'baseActions')

export { useProvideWsBaseListActions, useWsBaseListActions }

export function useWsBaseListActionsOrThrow() {
  const wsBaseListActions = useWsBaseListActions()
  if (wsBaseListActions == null) throw new Error('Please call `useProvideWsBaseListActions` on the appropriate parent component')
  return wsBaseListActions
}
