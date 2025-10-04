<script lang="ts" setup>
interface Props {
  modelValue?: boolean
  baseId: string
  title: string
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const basesStore = useBases()

const { updateProject, loadProject } = basesStore

const { bases } = storeToRefs(basesStore)

const dialogShow = useVModel(props, 'modelValue', emit)

const currentBase = computedAsync(async () => {
  if (!props.baseId) return

  let base = bases.value.get(props.baseId)

  if (!base) {
    await loadProject(props.baseId)
    base = bases.value.get(props.baseId)
  }

  return base
})

const inputEl = ref()

const form = reactive({
  title: '',
  modalInput: '',
})

const formRules = {
  title: [
    { required: true, message: 'Base name required' },
    { min: 3, message: 'Base name must be at least 3 characters long' },
    { max: 50, message: 'Base name must be at most 50 characters long' },
  ],
}

const formValidator = ref()
const isErrored = ref(false)
const isTitleUpdating = ref(false)
const isCancelButtonVisible = ref(false)

const titleChange = async () => {
  const valid = await formValidator.value.validate()

  if (!valid) return

  if (isTitleUpdating.value) return

  isTitleUpdating.value = true
  isErrored.value = false

  try {
    await updateProject(currentBase.value!.id!, {
      title: form.title.trim(),
    })
    dialogShow.value = false
  } catch (e: any) {
    console.error(e)
  } finally {
    isTitleUpdating.value = false
    isCancelButtonVisible.value = false
  }
}

onMounted(() => {
  form.title = props.title
  inputEl.value?.focus()
})

watch(form, async () => {
  try {
    isCancelButtonVisible.value = form.title !== currentBase.value?.title
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
        {{ $t('activity.renameBase') }}
      </div>
    </template>
    <div class="mt-2">
      <a-form ref="formValidator" :model="form" name="rename-base-form">
        <a-form-item :rules="formRules.title">
          <a-input
            ref="inputEl"
            v-model:value="form.title"
            :placeholder="$t('msg.info.enterBaseName')"
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
          :disabled="isErrored || form.title === currentBase?.title"
          :loading="isTitleUpdating"
          label="Rename Workspace"
          loading-label="Renaming workspace"
          type="primary"
          @click="() => titleChange()"
        >
          {{ $t('title.renameBase') }}
          <template #loading> {{ $t('title.renamingBase') }}</template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
