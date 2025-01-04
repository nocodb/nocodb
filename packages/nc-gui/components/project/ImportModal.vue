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
  if (!source.value.id || !source.value.base_id) return

  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'baseId': source.value.base_id,
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
      <div class="flex items-center gap-3 mb-6">
        <div class="text-base font-weight-700">{{ $t('general.import') }} table</div>
      </div>
      <NcMenu class="border-1 divide-y-1 nc-import-items-menu">
        <NcMenuItem @click="onClick('airtable')">
          <GeneralIcon icon="airtable" class="w-5 h-5" />
          <span class="ml-1">
            Airtable
          </span>
          <GeneralIcon icon="chevronRight" class="ml-auto text-lg" />
        </NcMenuItem>
        <NcMenuItem @click="onClick('csv')">
          <GeneralIcon class="text-white w-5 h-5" icon="ncFileTypeExcel" />
          <span class="ml-1">
            CSV / Json
          </span>
          <GeneralIcon icon="chevronRight" class="ml-auto text-lg" />
        </NcMenuItem>
        <NcMenuItem @click="onClick('excel')">
          <GeneralIcon icon="excelColored" class="w-5 h-5" />
          <span class="ml-1">
            Excel
          </span>
          <GeneralIcon icon="chevronRight" class="ml-auto text-lg" />
        </NcMenuItem>
        <NcMenuItem>
          <GeneralIcon icon="code" class="w-5 h-5" />
          <span class="ml-1">
            Sheet
          </span>
          <GeneralIcon icon="chevronRight" class="ml-auto text-lg" />
        </NcMenuItem>
        <NcMenuItem disabled>
          <GeneralIcon icon="salesforce" class="w-5 h-5 text-white" />
          <span class="ml-1">
            Salesforce
          </span>
          <span class="ml-auto text-primary opacity-75 mr-2">
            Coming soon
          </span>
          <GeneralIcon icon="chevronRight" class="text-lg" />
        </NcMenuItem>
        <NcMenuItem disabled>
          <GeneralIcon icon="csv" class="w-5 h-5" />
          <span class="ml-1">
            Monday.com
          </span>
          <span class="ml-auto text-primary opacity-75 mr-2">
            Coming soon
          </span>
          <GeneralIcon icon="chevronRight" class="text-lg" />
        </NcMenuItem>
      </NcMenu>
    </div>
  </GeneralModal>
</template>

<style lang="scss" scoped>
.nc-import-items-menu {
  padding: 0 !important;
  & :deep(.nc-menu-item) {
    margin: 0 !important;
    &.ant-menu-item-disabled {
      @apply bg-gray-50;
    }
    & .ant-menu-title-content {
      width: 100%;
      display: flex;
      align-items: center;
      & .nc-menu-item-inner {
        width: 100%;
      }
    }
  }
}
</style>
