import type { SourceType } from 'nocodb-sdk'
import type { InjectionKey } from 'vue'

export interface BaseActionsContext {
  // Actions
  onRename: (base: NcProject, title: string) => Promise<void>
  onToggleStarred: (base: NcProject) => Promise<void>
  onDuplicate: (base: NcProject) => void
  onOpenErd: (base: NcProject, source: SourceType) => void
  onOpenSettings: (baseId: string) => Promise<void>
  onDelete: (base: NcProject) => void
  onUpdateColor: (base: NcProject, color: string) => Promise<void>
  onReorder: (base: NcProject, newOrder: number) => Promise<void>
  onSelect: (base: NcProject) => Promise<void>
  // Close modal callback
  closeModal: () => void
}

export const BaseActionsKey: InjectionKey<BaseActionsContext> = Symbol('BaseActions')

export function useBaseActionsProvider(closeModal: () => void) {
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

  // Helper to get base from any workspace
  const getBaseFromWorkspace = (workspaceId: string, baseId: string): NcProject | undefined => {
    return workspaceBasesMap.value.get(workspaceId)?.get(baseId)
  }

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
      // Optimistically update UI
      updateBaseInWorkspace(base, { title })

      // API call
      await $api.base.update(base.id!, { title })
      $e('a:base:rename')
    } catch (e: any) {
      // Revert on error
      updateBaseInWorkspace(base, { title: base.title })
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const onToggleStarred = async (base: NcProject) => {
    try {
      const newStarredState = !base.starred

      // Optimistically update UI
      updateBaseInWorkspace(base, { starred: newStarredState })

      // API call
      await $api.base.userMetaUpdate(base.id!, { starred: newStarredState })
      $e('a:base:starred:toggle')
    } catch (e: any) {
      // Revert on error
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

      // Optimistically update UI
      updateBaseInWorkspace(base, { meta: newMeta as any })

      // API call
      await $api.base.update(base.id!, { meta: JSON.stringify(newMeta) })
      $e('a:base:icon:color:modal', { iconColor: color })
    } catch (e: any) {
      // Revert on error
      updateBaseInWorkspace(base, { meta: base.meta })
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const onReorder = async (base: NcProject, newOrder: number) => {
    try {
      const oldOrder = base.order

      // Optimistically update UI
      updateBaseInWorkspace(base, { order: newOrder })

      // API call
      await $api.base.update(base.id!, { order: newOrder })
      $e('a:base:reorder')
    } catch (e: any) {
      // Revert on error
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

  const context: BaseActionsContext = {
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

  // Provide context to child components
  provide(BaseActionsKey, context)

  return {
    dialogState,
    ...context,
  }
}

export function useBaseActions() {
  const context = inject(BaseActionsKey)
  if (!context) {
    throw new Error('useBaseActions must be used within a BaseActionsProvider')
  }
  return context
}
