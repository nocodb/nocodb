<script lang="ts" setup>
import type { SourceType } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  source: SourceType
}>()

const emits = defineEmits(['update:visible'])

const source = toRef(props, 'source')

const visible = useVModel(props, 'visible', emits)

const transitionName = ref<string | undefined>(undefined)

const { $e } = useNuxtApp()

const { isFeatureEnabled } = useBetaFeatureToggle()

async function openAirtableImportDialog(baseId?: string, sourceId?: string) {
  if (!baseId || !sourceId) return

  $e('a:actions:import-airtable')

  const isOpen = ref(true)
  transitionName.value = 'dissolve'

  await nextTick()
  visible.value = false

  const { close } = useDialog(resolveComponent('DlgAirtableImport'), {
    'modelValue': isOpen,
    'baseId': baseId,
    'sourceId': sourceId,
    'onUpdate:modelValue': closeDialog,
    'transition': 'dissolve',
    'onBack': () => {
      visible.value = true
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

async function openNocoDbImportDialog(baseId?: string) {
  if (!baseId) return

  // $e('a:actions:import-nocodb')

  const isOpen = ref(true)
  transitionName.value = 'dissolve'

  await nextTick()
  visible.value = false

  const { close } = useDialog(resolveComponent('DlgNocoDbImport'), {
    'modelValue': isOpen,
    'baseId': baseId,
    'onUpdate:modelValue': closeDialog,
    'transition': 'dissolve',
    'onBack': () => {
      visible.value = true
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

async function openQuickImportDialog(type: 'csv' | 'excel' | 'json') {
  if (!source.value.id || !source.value.base_id) return

  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)
  transitionName.value = 'dissolve'

  await nextTick()
  visible.value = false

  const { close } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'baseId': source.value.base_id,
    'sourceId': source.value.id,
    'onUpdate:modelValue': closeDialog,
    'transition': 'dissolve',
    'onBack': () => {
      visible.value = true
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const onClick = (type: 'airtable' | 'csv' | 'excel' | 'json' | 'nocodb') => {
  if (type === 'airtable') {
    openAirtableImportDialog(source.value.base_id, source.value.id)
  } else if (type === 'nocodb') {
    openNocoDbImportDialog(source.value.base_id)
  } else {
    openQuickImportDialog(type)
  }
}
</script>

<template>
  <GeneralModal v-model:visible="visible" width="448px" class="!top-[25vh]" :transition-name="transitionName">
    <div class="flex flex-col px-6 pt-6 pb-9">
      <div class="flex items-center gap-3 mb-6">
        <div class="text-base font-weight-700">{{ $t('labels.importDataFrom') }}</div>
      </div>
      <NcMenu class="border-1 divide-y-1 nc-import-items-menu overflow-clip">
        <NcMenuItem @click="onClick('airtable')">
          <GeneralIcon icon="importAirtable" class="w-5 h-5" />
          <span class="ml-1 text-[13px] font-weight-700"> Airtable </span>
          <GeneralIcon icon="chevronRight" class="ml-auto text-lg" />
        </NcMenuItem>
        <NcMenuItem @click="onClick('csv')">
          <GeneralIcon icon="importCsv" class="w-5 h-5" />
          <span class="ml-1 text-[13px] font-weight-700"> CSV </span>
          <GeneralIcon icon="chevronRight" class="ml-auto text-lg" />
        </NcMenuItem>
        <NcMenuItem @click="onClick('json')">
          <GeneralIcon icon="importJson" class="w-5 h-5" />
          <span class="ml-1 text-[13px] font-weight-700"> Json </span>
          <GeneralIcon icon="chevronRight" class="ml-auto text-lg" />
        </NcMenuItem>
        <NcMenuItem @click="onClick('excel')">
          <GeneralIcon icon="importExcel" class="w-5 h-5" />
          <span class="ml-1 text-[13px] font-weight-700"> Excel </span>
          <GeneralIcon icon="chevronRight" class="ml-auto text-lg" />
        </NcMenuItem>
        <NcMenuItem v-if="isFeatureEnabled(FEATURE_FLAG.IMPORT_FROM_NOCODB)" @click="onClick('nocodb')">
          <GeneralIcon icon="nocodb" class="w-5 h-5" />
          <span class="ml-1 text-[13px] font-weight-700"> NocoDB </span>
          <GeneralIcon icon="chevronRight" class="ml-auto text-lg" />
        </NcMenuItem>
        <!-- <NcMenuItem disabled>
          <GeneralIcon icon="importSheets" class="w-5 h-5 opacity-50" />
          <span class="ml-1 text-[13px] font-weight-700 text-[#6A7184]">
            Sheet
          </span>
          <span class="ml-auto text-primary bg-[#F0F3FF] px-1 rounded-md mr-2 font-weight-500 text-[13px]">
            Coming soon
          </span>
          <GeneralIcon icon="chevronRight" class="text-lg" />
        </NcMenuItem> -->
        <!-- <NcMenuItem disabled>
          <GeneralIcon icon="importSalesforce" class="w-5 h-5 text-white" />
          <span class="ml-1 text-[13px] font-weight-700 text-[#6A7184]">
            Salesforce
          </span>
          <span class="ml-auto text-primary bg-[#F0F3FF] px-1 rounded-md mr-2 font-weight-500 text-[13px]">
            Coming soon
          </span>
          <GeneralIcon icon="chevronRight" class="text-lg" />
        </NcMenuItem> -->
        <!-- <NcMenuItem disabled>
          <GeneralIcon icon="importMonday" class="w-5 h-5" />
          <span class="ml-1 text-[13px] font-weight-700 text-[#6A7184]">
            Monday.com
          </span>
          <span class="ml-auto text-primary bg-[#F0F3FF] px-1 rounded-md mr-2 font-weight-500 text-[13px]">
            Coming soon
          </span>
          <GeneralIcon icon="chevronRight" class="text-lg" />
        </NcMenuItem> -->
      </NcMenu>
    </div>
  </GeneralModal>
</template>

<style lang="scss" scoped>
.nc-import-items-menu {
  padding: 0 !important;
  border-radius: 8px !important;
  & :deep(.nc-menu-item) {
    &:hover {
      @apply bg-gray-50 text-black;
    }
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
