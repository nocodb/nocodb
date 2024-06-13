<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'

const props = defineProps<{
  column: ColumnType
  optionId?: string
  isNewStack?: boolean
}>()

const emit = defineEmits(['submit'])

const { column, optionId, isNewStack } = toRefs(props)

const meta = inject(MetaInj, ref())

const { formState, addOrUpdate } = useProvideColumnCreateStore(meta, column, undefined, undefined, undefined, ref(true))

const { getMeta } = useMetas()

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

  if (submit) {
    emit('submit', true)
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
    class="w-full flex"
  >
    <SmartsheetColumnSelectOptions
      v-model:value="formState"
      is-kanban-stack
      :option-id="optionId"
      :is-new-stack="isNewStack"
      @save-changes="onSubmit"
    />
  </a-form>
</template>
