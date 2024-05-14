<script lang="ts" setup>
interface Props {
  modelValue?: boolean
  workspaceId: string
  title: string
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { updateWorkspace, loadWorkspace } = useWorkspace()

const dialogShow = useVModel(props, 'modelValue', emit)

const title = useVModel(props, 'title', emit)

const workspaceId = computed(() => props.workspaceId)

const inputEl = ref()

const { workspaces } = storeToRefs(useWorkspace())

const currentWorkspace = computedAsync(async () => {
  let ws = workspaces.value.get(workspaceId.value)

  if (!ws) {
    await loadWorkspace(workspaceId.value)
    ws = workspaces.value.get(workspaceId.value)
  }

  return ws
})

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

const formValidator = ref()
const isErrored = ref(false)
const isTitleUpdating = ref(false)
const isCancelButtonVisible = ref(false)

const titleChange = async () => {
  const valid = await formValidator.value.validate()

  if (!valid || !currentWorkspace.value?.id || isTitleUpdating.value) return

  isTitleUpdating.value = true
  isErrored.value = false

  try {
    await updateWorkspace(currentWorkspace.value?.id, {
      title: form.title,
    })
    dialogShow.value = false
  } catch (e: any) {
    isErrored.value = true
  } finally {
    isTitleUpdating.value = false
    isCancelButtonVisible.value = false
  }
}

onMounted(() => {
  form.title = title.value
  inputEl.value.focus()
})

watch(form, async () => {
  try {
    isCancelButtonVisible.value = form.title !== currentWorkspace.value?.title
    isErrored.value = !(await formValidator.value.validate())
  } catch (e: any) {
    isErrored.value = true
  }
})
</script>

<template>
  <NcModal v-model:visible="dialogShow" size="small">
    <template #header>
      <div class="flex flex-row items-center gap-x-2">
        <GeneralIcon icon="rename" />
        {{ $t('activity.renameWorkspace') }}
      </div>
    </template>
    <div class="mt-2">
      <a-form ref="formValidator" :model="form" name="rename-workspace-form">
        <a-form-item :rules="formRules.title">
          <a-input
            ref="inputEl"
            v-model:value="form.title"
            :placeholder="$t('msg.info.enterWorkspaceName')"
            class="nc-input-md"
            hide-details
            size="large"
            @keydown.enter="titleChange"
          />
        </a-form-item>
      </a-form>
      <div class="flex flex-row justify-end gap-x-2 mt-6">
        <NcButton type="secondary" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>

        <NcButton
          key="submit"
          :disabled="isErrored || form.title === currentWorkspace?.title"
          :loading="isTitleUpdating"
          label="Rename Workspace"
          loading-label="Renaming workspace"
          type="primary"
          @click="() => titleChange()"
        >
          {{ $t('title.renameWorkspace') }}
          <template #loading> {{ $t('title.renamingWorkspace') }}</template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
