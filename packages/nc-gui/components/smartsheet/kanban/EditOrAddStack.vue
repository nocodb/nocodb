<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'

const props = defineProps<{
  column: ColumnType
  optionId?: string
  isNewStack?: boolean
}>()

const emit = defineEmits(['submit', 'cancel'])

const { column, optionId, isNewStack } = toRefs(props)

const meta = inject(MetaInj, ref())

const { formState, addOrUpdate } = useProvideColumnCreateStore(meta, column, undefined, undefined, undefined, ref(true))

const { getMeta } = useMetas()

const reloadMetaAndData = async () => {
  await getMeta(meta.value?.id as string, true)
}

async function onSubmit(
  submit = false,
  saveChanges = true,
  payload: Partial<{ color: string; title: string; [key: string]: any }>,
) {
  if (!saveChanges && submit) {
    emit('submit')
    return
  }

  const saved = await addOrUpdate(reloadMetaAndData)

  if (submit && saved) {
    emit('submit', true, payload)
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
