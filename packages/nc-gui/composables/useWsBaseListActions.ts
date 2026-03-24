import type { SourceType } from 'nocodb-sdk'
import { DlgBaseErd } from '#components'

const [useProvideWsBaseListActions, useWsBaseListActions] = useInjectionState((closeModal: () => void) => {
  const basesStore = useBases()
  const { workspaceBasesMap, bases, isProjectsLoaded } = storeToRefs(basesStore)

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const { navigateToProject, getBaseUrl } = useGlobal()
  const { $api, $e } = useNuxtApp()
  const route = useRoute()

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

  const onReorder = async (base: NcProject, newOrder: number) => {
    try {
      updateBaseInWorkspace(base, { order: newOrder })
      await $api.base.update(base.id!, { order: newOrder })
      $e('a:base:reorder')
    } catch (e: any) {
      updateBaseInWorkspace(base, { order: base.order })
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const onSelect = async (base: NcProject) => {
    // Prevent selecting bases in locked workspaces (CE mode, non-default)
    if (workspaceStore.isWorkspaceCeLocked(base.fk_workspace_id)) return

    $e('a:workspace:base:select')
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
    onReorder,
    onSelect,
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
