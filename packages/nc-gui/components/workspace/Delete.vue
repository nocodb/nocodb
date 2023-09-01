<script lang="ts" setup>
const isConfirmed = ref(false)
const isDeleting = ref(false)
const { signOut } = useGlobal()

const { deleteWorkspace, navigateToWorkspace } = useWorkspace()
const { workspacesList, activeWorkspaceId } = storeToRefs(useWorkspace())

const onDelete = async () => {
  isDeleting.value = true
  try {
    await deleteWorkspace(activeWorkspaceId.value, { skipStateUpdate: true })

    isConfirmed.value = false
    isDeleting.value = false

    // As signin page will clear the workspaces, we need to check if there are more than one workspace
    if (workspacesList.value.length > 1) {
      await navigateToWorkspace(workspacesList.value.filter((w) => w.id !== activeWorkspaceId.value)[0].id)
    } else {
      await signOut()
      setTimeout(() => {
        window.location.href = '/'
      }, 100)
    }
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center">
    <div class="item flex flex-col">
      <div class="font-medium text-base">Delete Workspace</div>
      <div class="text-gray-500 mt-2">Delete this workspace and all it’s contents.</div>

      <div class="flex flex-row mt-8 gap-x-2">
        <a-checkbox v-model:checked="isConfirmed" />
        <div class="flex">I understand that this action is irreversible</div>
      </div>

      <div class="flex flex-row w-full justify-end mt-8">
        <NcButton type="danger" :disabled="!isConfirmed" :loading="isDeleting" @click="onDelete">
          <template #loading> Deleting Workspace </template>
          Delete Workspace
        </NcButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.item {
  @apply p-6 rounded-2xl border-1 max-w-180 mt-10 min-w-100;
}
</style>
