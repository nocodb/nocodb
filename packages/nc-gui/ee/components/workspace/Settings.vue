<script lang="ts" setup>
const props = defineProps<{
  workspaceId?: string
}>()

const { signOut } = useGlobal()

const { deleteWorkspace, navigateToWorkspace, updateWorkspace, loadWorkspace } = useWorkspace()
const { workspacesList, activeWorkspace, workspaces } = storeToRefs(useWorkspace())

const { orgId } = useOrganization()

const { refreshCommandPalette } = useCommandPalette()

const router = useRouter()

const formValidator = ref()
const isDeleting = ref(false)
const isErrored = ref(false)
const isTitleUpdating = ref(false)
const isCancelButtonVisible = ref(false)
const isDeleteModalVisible = ref(false)
// if activeworkspace.title is used it will show new workspace name in loading state
const toBeDeletedWorkspaceTitle = ref('')
const isAdminPanel = inject(IsAdminPanelInj, ref(false))

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

const currentWorkspace = computedAsync(async () => {
  if (props.workspaceId) {
    const ws = workspacesList.value.find((workspace) => workspace.id === props.workspaceId)
    if (!ws) {
      await loadWorkspace(props.workspaceId)
      return workspacesList.value.find((workspace) => workspace.id === props.workspaceId)
    }
    return ws
  }
  return activeWorkspace.value
})

const onDelete = async () => {
  if (!currentWorkspace.value || !currentWorkspace.value.id) return

  isDeleting.value = true
  try {
    const shouldSignOut = workspacesList.value.length < 2
    await deleteWorkspace(currentWorkspace.value.id, { skipStateUpdate: true })
    // We only remove the delete workspace from the list after the api call is successful

    if (isAdminPanel.value) {
      router.replace({ hash: `#/admin/${orgId.value}/workspaces` })
    }

    workspaces.value.delete(currentWorkspace.value.id)
    if (!shouldSignOut && !isAdminPanel.value) {
      await navigateToWorkspace(workspacesList.value[0].id)
    } else if (!isAdminPanel.value) {
      // As signin page will clear the workspaces, we need to check if there are more than one workspace
      await signOut({ skipRedirect: false })
      setTimeout(() => {
        window.location.href = '/'
      }, 100)
    }
  } finally {
    isDeleting.value = false
    refreshCommandPalette()
    toBeDeletedWorkspaceTitle.value = ''
  }
}

const rules = {
  modalInput: [{ required: true, message: 'input is required.' }],
}

const titleChange = async () => {
  if (!currentWorkspace.value || !currentWorkspace.value.id || isTitleUpdating.value) return

  const valid = await formValidator.value.validate()

  if (!valid) return

  isTitleUpdating.value = true
  isErrored.value = false

  try {
    await updateWorkspace(currentWorkspace.value?.id, {
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
  if (!currentWorkspace.value || !currentWorkspace.value.title) return
  toBeDeletedWorkspaceTitle.value = currentWorkspace.value.title
  isDeleteModalVisible.value = true
}

watch(
  currentWorkspace,
  () => {
    form.title = currentWorkspace.value?.title ?? ''
  },
  {
    immediate: true,
  },
)

watch(
  () => form.title,
  async () => {
    try {
      if (!currentWorkspace.value) return
      isCancelButtonVisible.value = form.title !== currentWorkspace.value.title
      isErrored.value = !(await formValidator.value.validate())
    } catch (e: any) {
      isErrored.value = true
    }
  },
)

const onCancel = () => {
  if (currentWorkspace.value?.title) form.title = currentWorkspace.value.title
}
</script>

<template>
  <div
    class="flex flex-col items-center nc-workspace-settings-settings pb-10 overflow-y-auto nc-scrollbar-x-lg px-6"
    :class="{
      'h-[calc(100vh-144px)]': isAdminPanel,
      'h-[calc(100vh-92px)]': !isAdminPanel,
    }"
  >
    <div class="item-card flex flex-col w-full">
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
            v-e="['c:workspace:settings:rename']"
            type="primary"
            html-type="submit"
            :disabled="isErrored || !!(form.title && form.title === currentWorkspace?.title)"
            :loading="isDeleting"
            data-testid="nc-workspace-settings-settings-rename-submit"
          >
            <template #loading> Renaming Workspace </template>
            Rename Workspace
          </NcButton>
        </div>
      </a-form>
    </div>
    <div class="item-card flex flex-col border-1 border-red-500">
      <div class="font-medium text-base">Delete Workspace</div>
      <div class="text-gray-500 mt-2">Delete this workspace and all it’s contents.</div>
      <div class="flex p-4 border-1 rounded-lg mt-6 items-center">
        <component :is="iconMap.error" class="text-red-500 text-xl" />
        <div class="font-sm text-normal font-medium ml-3">This action is irreversible</div>
      </div>
      <div class="flex flex-row w-full justify-end mt-8">
        <NcButton v-e="['c:workspace:settings:delete']" type="danger" @click="handleDelete"> Delete Workspace </NcButton>
      </div>
    </div>
  </div>

  <GeneralModal v-model:visible="isDeleteModalVisible" class="nc-attachment-rename-modal" size="small">
    <div class="flex flex-col items-center justify-center h-full !p-6">
      <div class="text-lg font-semibold self-start mb-5">Delete Workspace</div>
      <span class="self-start mb-2"
        >Enter workspace name to delete - <b class="select-none"> ‘{{ toBeDeletedWorkspaceTitle }}’ </b>
      </span>
      <a-form class="w-full h-full" no-style :model="form" @finish="onDelete">
        <a-form-item class="w-full !mb-0" name="title" :rules="rules.modalInput">
          <a-input
            ref="inputEl"
            v-model:value="form.modalInput"
            class="w-full nc-input-sm nc-input-shadow"
            placeholder="Workspace Name"
          />
        </a-form-item>
        <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
          <NcButton html-type="back" type="secondary" size="small" @click="isDeleteModalVisible = false"
            >{{ $t('general.cancel') }}
          </NcButton>
          <NcButton
            key="submit"
            v-e="['a:workspace:settings:delete']"
            html-type="submit"
            type="danger"
            size="small"
            :disabled="form.modalInput !== currentWorkspace?.title"
            :loading="isDeleting"
            >Delete Workspace</NcButton
          >
        </div>
      </a-form>
    </div>
  </GeneralModal>
</template>

<style lang="scss" scoped>
.item-card {
  @apply p-6 rounded-2xl border-1 max-w-[600px] mt-10 min-w-100 w-full;
}
</style>
