<script lang="ts" setup>
const isConfirmed = ref(false)
const isDeleting = ref(false)
const { signOut } = useGlobal()

const { deleteWorkspace, navigateToWorkspace } = useWorkspace()
const { workspacesList, activeWorkspaceId } = storeToRefs(useWorkspace())

const onDelete = async () => {
  isDeleting.value = true
  try {
    await deleteWorkspace(activeWorkspaceId.value)

    isConfirmed.value = false
    isDeleting.value = false

    if (workspacesList.value.length > 0) {
      await navigateToWorkspace(workspacesList.value[0].id)
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
      <div class="flex flex-row p-4 border-1 rounded-lg gap-x-2 mt-6">
        <div class="flex">
          <GeneralIcon icon="warning" class="text-xl text-orange-600" />
        </div>
        <div class="flex flex-col items-start gap-y-1">
          <div class="flex font-medium">This action is irreversible.</div>
          <div class="flex flex-row text-gray-500">
            You have 31 days to undo this action by following the steps provided in recover workspace mail sent to your email.
          </div>
        </div>
      </div>
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
  @apply p-6 rounded-2xl border-1 max-w-180 mt-10;
}
</style>
