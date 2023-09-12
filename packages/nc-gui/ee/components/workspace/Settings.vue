<script lang="ts" setup>
const { signOut } = useGlobal()

const { deleteWorkspace, navigateToWorkspace, updateWorkspace } = useWorkspace()
const { workspacesList, activeWorkspaceId, activeWorkspace, workspaces } = storeToRefs(useWorkspace())

const formValidator = ref()
const isDeleting = ref(false)
const isErrored = ref(false)
const isTitleUpdating = ref(false)
const isCancelButtonVisible = ref(false)
const isModalVisible = ref(false)
// if activeworkspace.title is used it will show new workspace name in loading state
const workspaceToDelete = ref('')

const form = reactive({
  title: '',
  modalInput: '',
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
    const shouldSignOut = workspacesList.value.length < 2
    await deleteWorkspace(activeWorkspaceId.value, { skipStateUpdate: true })
    // We only remove the delete workspace from the list after the api call is successful
    workspaces.value.delete(activeWorkspaceId.value)
    if (!shouldSignOut) {
      await navigateToWorkspace(workspacesList.value[0].id)
    } else {
      // As signin page will clear the workspaces, we need to check if there are more than one workspace
      await signOut(false)
      setTimeout(() => {
        window.location.href = '/'
      }, 100)
    }
  } finally {
    isDeleting.value = false
    workspaceToDelete.value = activeWorkspace.value?.title
  }
}

const rules = {
  modalInput: [{ required: true, message: 'input is required.' }],
}

const titleChange = async () => {
  const valid = await formValidator.value.validate()

  if (!valid) return

  if (isTitleUpdating.value) return

  isTitleUpdating.value = true
  isErrored.value = false

  try {
    await updateWorkspace(activeWorkspaceId.value, {
      title: form.title,
    })
  } catch (e: any) {
    console.error(e)
  } finally {
    isTitleUpdating.value = false
    isCancelButtonVisible.value = false
  }
}

const handleDelete = () => {
  workspaceToDelete.value = activeWorkspace.value?.title
  isModalVisible.value = true
}

watch(
  () => activeWorkspace.value.title,
  () => {
    form.title = activeWorkspace.value.title
  },
  {
    immediate: true,
  },
)

watch(
  () => form.title,
  async () => {
    try {
      if (form.title !== activeWorkspace.value?.title) {
        isCancelButtonVisible.value = true
      } else {
        isCancelButtonVisible.value = false
      }
      isErrored.value = !(await formValidator.value.validate())
    } catch (e: any) {
      isErrored.value = true
    }
  },
)

const onCancel = () => {
  form.title = activeWorkspace.value?.title
}
</script>

<template>
  <div class="flex flex-col items-center nc-workspace-settings-settings">
    <div class="item flex flex-col w-full">
      <div class="font-medium text-base">Change Workspace Name</div>
      <a-form ref="formValidator" layout="vertical" no-style :model="form" class="w-full" @finish="titleChange">
        <div class="text-gray-500 mt-6 mb-1.5">Workspace name</div>
        <a-form-item name="title" :rules="formRules.title">
          <a-input
            v-model:value="form.title"
            class="w-full !rounded-md !py-1.5"
            placeholder="Workspace name"
            data-testid="nc-workspace-settings-settings-rename-input"
          />
        </a-form-item>
        <div class="flex flex-row w-full justify-end mt-8 gap-4">
          <NcButton
            v-if="isCancelButtonVisible"
            type="secondary"
            data-testid="nc-workspace-settings-settings-rename-cancel"
            @click="onCancel"
          >
            Cancel
          </NcButton>
          <NcButton
            type="primary"
            html-type="submit"
            :disabled="isErrored || (form.title && form.title === activeWorkspace.title)"
            :loading="isDeleting"
            data-testid="nc-workspace-settings-settings-rename-submit"
          >
            <template #loading> Renaming Workspace </template>
            Rename Workspace
          </NcButton>
        </div>
      </a-form>
    </div>
    <div class="item flex flex-col border-1 border-red-500">
      <div class="font-medium text-base">Delete Workspace</div>
      <div class="text-gray-500 mt-2">Delete this workspace and all it’s contents.</div>
      <div class="flex flex-row w-full justify-end mt-8">
        <NcButton type="danger" @click="handleDelete"> Delete Workspace </NcButton>
      </div>
    </div>
  </div>

  <GeneralModal v-model:visible="isModalVisible" class="nc-attachment-rename-modal !w-112">
    <div class="flex flex-col items-center justify-center h-full !p-6">
      <div class="text-lg font-semibold self-start mb-4">Delete Workspace</div>
      <span class="self-start mb-2"
        >Enter workspace name to delete - <b class="select-none"> ‘{{ workspaceToDelete }}’ </b>
      </span>
      <a-form class="w-full h-full" no-style :model="form" @finish="onDelete">
        <a-form-item class="w-full" name="title" :rules="rules.modalInput">
          <a-input
            ref="inputEl"
            v-model:value="form.modalInput"
            class="w-full !rounded-lg !h-4 !px-2 !py-4"
            placeholder="Type.."
          />
        </a-form-item>
        <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
          <NcButton html-type="back" type="secondary" @click="isModalVisible = false">{{ $t('general.cancel') }} </NcButton>
          <NcButton
            key="submit"
            html-type="submit"
            type="danger"
            :disabled="form.modalInput !== activeWorkspace.title"
            :loading="isDeleting"
            >Delete Workspace</NcButton
          >
        </div>
      </a-form>
    </div>
  </GeneralModal>
</template>

<style lang="scss" scoped>
.item {
  @apply p-6 rounded-2xl border-1 max-w-180 mt-10 min-w-100 w-full;
}
</style>
