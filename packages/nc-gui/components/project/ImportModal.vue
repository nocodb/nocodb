<script lang="ts" setup>
import type { BaseType } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  base: BaseType
}>()

const emits = defineEmits(['update:visible'])

const base = toRef(props, 'base')

const visible = useVModel(props, 'visible', emits)

const { $e } = useNuxtApp()

function openAirtableImportDialog(baseId?: string) {
  if (!baseId) return

  $e('a:actions:import-airtable')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgAirtableImport'), {
    'modelValue': isOpen,
    'baseId': baseId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openQuickImportDialog(type: 'csv' | 'excel' | 'json') {
  if (!base.value.id) return

  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'baseId': base.value.id,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const onClick = (type: 'airtable' | 'csv' | 'excel' | 'json') => {
  visible.value = false

  if (type === 'airtable') {
    openAirtableImportDialog(base.value.id)
  } else {
    openQuickImportDialog(type)
  }
}
</script>

<template>
  <GeneralModal v-model:visible="visible" width="35rem">
    <div class="flex flex-col px-8 pt-6 pb-9">
      <div class="text-lg font-medium mb-6">Import</div>
      <div class="row mb-10">
        <div class="nc-project-view-import-sub-btn" @click="onClick('airtable')">
          <GeneralIcon icon="airtable" />
          <div class="label">Airtable</div>
        </div>
        <div class="nc-project-view-import-sub-btn" @click="onClick('csv')">
          <GeneralIcon icon="csv" />
          <div class="label">CSV</div>
        </div>
      </div>
      <div class="row">
        <div class="nc-project-view-import-sub-btn" @click="onClick('excel')">
          <GeneralIcon icon="excelColored" />
          <div class="label">Excel</div>
        </div>
        <div class="nc-project-view-import-sub-btn" @click="onClick('json')">
          <GeneralIcon icon="code" />
          <div class="label">JSON</div>
        </div>
      </div>
    </div>
  </GeneralModal>
</template>

<style lang="scss" scoped>
.row {
  @apply flex flex-row gap-x-10;
}
.nc-project-view-import-sub-btn {
  @apply flex flex-col gap-y-6 p-16 bg-gray-50 items-center justify-center rounded-xl w-56 cursor-pointer text-gray-600 hover:(bg-gray-100 !text-black);

  .nc-icon {
    @apply h-12 w-12;
  }

  .label {
    @apply text-lg font-medium;
  }
}
</style>
