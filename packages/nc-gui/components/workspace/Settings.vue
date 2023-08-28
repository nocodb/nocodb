<script lang="ts" setup>
const { signOut } = useGlobal()

const { deleteWorkspace, navigateToWorkspace, updateWorkspace } = useWorkspace()
const { workspacesList, activeWorkspaceId, activeWorkspace } = storeToRefs(useWorkspace())

const formValidator = ref()
const isConfirmed = ref(false)
const isDeleting = ref(false)
const isErrored = ref(false)
const isTitleUpdating = ref(false)

const form = ref({
  title: '',
})

const formRules = {
  title: [
    { required: true, message: 'Workspace name required' },
    { min: 3, message: 'Workspace name must be at least 3 characters long' },
    { max: 50, message: 'Workspace name must be at most 50 characters long' },
  ],
}

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

const titleChange = async () => {
  const valid = await formValidator.value.validate()

  if (!valid) return

  if (isTitleUpdating.value) return

  isTitleUpdating.value = true
  isErrored.value = false

  try {
    await updateWorkspace(activeWorkspaceId.value, {
      title: form.value.title,
    })
  } catch (e: any) {
    console.error(e)
  } finally {
    isTitleUpdating.value = false
  }
}

watch(
  () => activeWorkspace.value.title,
  () => {
    form.value.title = activeWorkspace.value.title
  },
  {
    immediate: true,
  },
)

watch(
  () => form.value.title,
  async () => {
    try {
      isErrored.value = !(await formValidator.value.validate())
    } catch (e: any) {
      isErrored.value = true
    }
  },
)
</script>

<template>
  <div class="flex flex-col items-center">
    <div class="item flex flex-col w-full">
      <div class="font-medium text-base">Change Workspace Name</div>

      <a-form ref="formValidator" layout="vertical" no-style :model="form" class="w-full" @finish="titleChange">
        <div class="text-gray-500 mt-6 mb-1.5">Workspace name</div>
        <a-form-item name="title" :rules="formRules.title">
          <a-input v-model:value="form.title" class="w-full !rounded-md !py-1.5" placeholder="Workspace name" />
        </a-form-item>
        <div class="flex flex-row w-full justify-end mt-8">
          <NcButton
            type="primary"
            html-type="submit"
            :disabled="isErrored || (form.title && form.title === activeWorkspace.title)"
            :loading="isDeleting"
          >
            <template #loading> Renaming Workspace </template>
            Rename Workspace
          </NcButton>
        </div>
      </a-form>
    </div>
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
