<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
  workspaceId: string
}>()

const emits = defineEmits(['update:visible'])
const visible = useVModel(props, 'visible', emits)

const workspaceStore = useWorkspace()

const { deleteWorkspace: _deleteWorkspace, loadWorkspaces, navigateToWorkspace, loadWorkspace } = workspaceStore

const { workspacesList, activeWorkspace } = storeToRefs(workspaceStore)

const { refreshCommandPalette } = useCommandPalette()

const workspace = computedAsync(async () => {
  if (props.workspaceId) {
    const ws = workspacesList.value.find((workspace) => workspace.id === props.workspaceId)
    if (!ws) {
      await loadWorkspace(props.workspaceId)

      return workspacesList.value.find((workspace) => workspace.id === props.workspaceId)
    }
  }
  return activeWorkspace.value ?? workspacesList.value[0]
})

const onDelete = async () => {
  if (!workspace.value) return

  try {
    await _deleteWorkspace(workspace.value.id!)
    await loadWorkspaces()

    if (!workspacesList.value?.[0]?.id) {
      return await navigateToWorkspace()
    }

    await navigateToWorkspace(workspacesList.value?.[0]?.id)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    refreshCommandPalette()
  }
}
</script>

<template>
  <GeneralDeleteModal v-model:visible="visible" :entity-name="$t('objects.workspace')" :on-delete="onDelete">
    <template #entity-preview>
      <div v-if="workspace" class="flex flex-row items-center py-2.25 px-2.75 bg-gray-50 rounded-lg text-gray-700">
        <GeneralIcon icon="workspace" />
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-2.25"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ workspace.title }}
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>
