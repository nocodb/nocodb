import type { SourceType } from 'nocodb-sdk'

const [useProvideBaseActions, useBaseActions] = useInjectionState((closeModal: () => void) => {
  const basesStore = useBases()
  const { workspaceBasesMap } = storeToRefs(basesStore)

  const { navigateToProject } = useGlobal()
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
    const workspaceBases = workspaceBasesMap.value.get(workspaceId)
    if (workspaceBases && base.id) {
      const existingBase = workspaceBases.get(base.id)
      if (existingBase) {
        workspaceBases.set(base.id, { ...existingBase, ...updates })
      }
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
      await $api.base.userMetaUpdate(base.id!, { starred: newStarredState })
      $e('a:base:starred:toggle')
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

    const { close } = useDialog(resolveComponent('DlgBaseErd'), {
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

  const onOpenSettings = async (baseId: string) => {
    closeModal()
    await navigateTo(`/${route.params.typeOrId}/${baseId}?page=base-settings`)
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
    $e('a:workspace:base:select')
    closeModal()

    await navigateToProject({
      baseId: base.id!,
      workspaceId: base.fk_workspace_id!,
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
  }
}, 'baseActions')

export { useProvideBaseActions, useBaseActions }

export function useBaseActionsOrThrow() {
  const baseActions = useBaseActions()
  if (baseActions == null) throw new Error('Please call `useProvideBaseActions` on the appropriate parent component')
  return baseActions
}
