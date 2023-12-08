<script lang="ts" setup>
import type { SourceType } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  source: SourceType
}>()

const emits = defineEmits(['update:visible'])

const source = toRef(props, 'source')

const visible = useVModel(props, 'visible', emits)

const { $e } = useNuxtApp()

function openAirtableImportDialog(baseId?: string, sourceId?: string) {
  if (!baseId || !sourceId) return

  $e('a:actions:import-airtable')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgAirtableImport'), {
    'modelValue': isOpen,
    'baseId': baseId,
    'sourceId': sourceId,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

function openQuickImportDialog(type: 'csv' | 'excel' | 'json') {
  if (!source.value.id) return

  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'sourceId': source.value.id,
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
    openAirtableImportDialog(source.value.base_id, source.value.id)
  } else {
    openQuickImportDialog(type)
  }
}
</script>

<template>
  <GeneralModal v-model:visible="visible" width="35rem">
    <div class="flex flex-col px-8 pt-6 pb-9">
      <div class="text-lg font-medium mb-6">{{ $t('general.import') }}</div>
      <div class="row mb-10">
        <div class="nc-base-view-import-sub-btn" @click="onClick('airtable')">
          <GeneralIcon icon="airtable" />
          <div class="label">{{ $t('labels.airtable') }}</div>
        </div>
        <div class="nc-base-view-import-sub-btn" @click="onClick('csv')">
          <GeneralIcon icon="csv" />
          <div class="label">{{ $t('labels.csv') }}</div>
        </div>
      </div>
      <div class="row">
        <div class="nc-base-view-import-sub-btn" @click="onClick('excel')">
          <GeneralIcon icon="excelColored" />
          <div class="label">{{ $t('labels.excel') }}</div>
        </div>
        <div class="nc-base-view-import-sub-btn" @click="onClick('json')">
          <GeneralIcon icon="code" />
          <div class="label">{{ $t('labels.json') }}</div>
        </div>
      </div>
    </div>
  </GeneralModal>
</template>

<style lang="scss" scoped>
.row {
  @apply flex flex-row gap-x-10;
}
.nc-base-view-import-sub-btn {
  @apply flex flex-col gap-y-6 p-16 bg-gray-50 items-center justify-center rounded-xl w-56 cursor-pointer text-gray-600 hover:(bg-gray-100 !text-black);

  .nc-icon {
    @apply h-12 w-12;
  }

  .label {
    @apply text-lg font-medium;
  }
}
</style>
