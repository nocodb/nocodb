<script lang="ts" setup>
const props = defineProps<{
  workspaceId?: string
}>()

const workspaceStore = useWorkspace()
const { updateWorkspace } = workspaceStore
const { activeWorkspace, workspaces } = storeToRefs(workspaceStore)

const { refreshCommandPalette } = useCommandPalette()

const { isUIAllowed } = useRoles()

const isSettingsSidebar = inject(IsSettingsSidebarInj, ref(false))

const formValidator = ref()
const isErrored = ref(false)
const isWorkspaceUpdating = ref(false)

const form = reactive<{
  title: string
}>({
  title: '',
})

const formRules = {
  title: [
    { required: true, message: 'Workspace name required' },
    { min: 3, message: 'Workspace name must be at least 3 characters long' },
    { max: 50, message: 'Workspace name must be at most 50 characters long' },
  ],
}

const hasWorkspaceManagePermission = computed(() => {
  return isUIAllowed('workspaceManage')
})

const currentWorkspace = computed(() => {
  if (props.workspaceId) {
    return workspaces.value.get(props.workspaceId) ?? activeWorkspace.value
  }
  return activeWorkspace.value
})

const isSaveChangesBtnEnabled = computed(() => {
  return !!(form.title && form.title !== currentWorkspace.value?.title)
})

const saveChanges = async () => {
  if (!currentWorkspace.value || !currentWorkspace.value.id || isWorkspaceUpdating.value) return

  const valid = await formValidator.value.validate()

  if (!valid) {
    isErrored.value = true
    return
  }

  isErrored.value = false
  isWorkspaceUpdating.value = true

  try {
    await updateWorkspace(currentWorkspace.value.id, { title: form.title })
    refreshCommandPalette()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isWorkspaceUpdating.value = false
  }
}

const onCancel = () => {
  if (currentWorkspace.value?.title) form.title = currentWorkspace.value.title
}

watch(
  currentWorkspace,
  () => {
    form.title = form.title || (currentWorkspace.value?.title ?? '')
  },
  { immediate: true },
)

watch(
  () => form.title,
  async () => {
    try {
      if (!currentWorkspace.value) return

      isErrored.value = !(await formValidator.value.validate())
    } catch {
      isErrored.value = true
    }
  },
)
</script>

<template>
  <div
    class="nc-workspace-settings-container overflow-auto nc-scrollbar-thin"
    :class="isSettingsSidebar ? 'h-[calc(100vh-var(--topbar-height))]' : 'h-[calc(100vh-var(--topbar-height)-44px)]'"
  >
    <div v-if="currentWorkspace" class="flex flex-col items-center pb-6 md:pb-10 px-4 md:px-6">
      <div class="nc-settings-item-card-wrapper mt-6 md:mt-10">
        <div class="nc-settings-item-heading text-nc-content-gray-emphasis">
          {{ $t('objects.workspace') }} {{ $t('general.appearance') }}
        </div>
        <div class="nc-settings-item-card flex flex-col w-full p-4 md:p-6">
          <a-form ref="formValidator" layout="vertical" no-style :model="form" class="w-full" @finish="saveChanges">
            <div class="flex-1">
              <div class="text-sm text-nc-content-gray-subtle2">{{ $t('general.name') }}</div>
              <a-form-item name="title" :rules="formRules.title" class="!mt-2 !mb-0">
                <a-input
                  v-model:value="form.title"
                  class="w-full !rounded-lg !px-4 h-10"
                  placeholder="Workspace name"
                  size="large"
                  :disabled="!hasWorkspaceManagePermission"
                  data-testid="nc-workspace-settings-settings-rename-input"
                />
              </a-form-item>
            </div>
            <div v-if="hasWorkspaceManagePermission" class="flex flex-row w-full justify-end mt-8 gap-4">
              <NcButton
                v-if="isSaveChangesBtnEnabled"
                type="secondary"
                size="small"
                :disabled="isWorkspaceUpdating"
                @click="onCancel"
              >
                {{ $t('general.cancel') }}
              </NcButton>
              <NcButton
                v-e="['c:workspace:settings:rename']"
                type="primary"
                html-type="submit"
                size="small"
                :disabled="isErrored || !isSaveChangesBtnEnabled || isWorkspaceUpdating"
                :loading="isWorkspaceUpdating"
              >
                <template #loading> {{ $t('general.saving') }} </template>
                {{ $t('general.save') }}
              </NcButton>
            </div>
          </a-form>
        </div>
      </div>
    </div>
  </div>
</template>
