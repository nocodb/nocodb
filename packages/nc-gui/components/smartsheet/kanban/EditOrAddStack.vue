<script lang="ts" setup>
const props = defineProps<{
  optionId?: string
  isNew?: boolean
  readonly?: boolean
}>()

const emit = defineEmits(['submit', 'cancel', 'mounted', 'add', 'update'])

const { optionId, isNew, readonly } = toRefs(props)

const { formState, addOrUpdate } = useColumnCreateStoreOrThrow()

const { loadKanbanMeta } = useKanbanViewStoreOrThrow()

const { getMeta } = useMetas()

const meta = inject(MetaInj, ref())

const reloadMetaAndData = async () => {
  await getMeta(meta.value?.id as string, true)
}

const saving = ref(false)

async function onSubmit(submit: boolean = false, saveChanges: boolean = true) {
  if (!saveChanges && submit) {
    emit('submit')
    return
  }

  saving.value = true
  const saved = await addOrUpdate(reloadMetaAndData)
  saving.value = false

  if (!saved) return

  await loadKanbanMeta()

  if (submit) {
    emit('submit')
  }
}
</script>

<template>
  <a-form
    v-model="formState"
    no-style
    name="column-create-or-edit"
    layout="vertical"
    data-testid="add-or-edit-column"
    class="w-full"
  >
    <SmartsheetColumnSelectOptions
      v-model:value="formState"
      is-kanban-stack
      :option-id="optionId"
      :is-new="isNew"
      @save-changes="onSubmit"
    />
  </a-form>
</template>

<style lang="scss" scoped></style>
