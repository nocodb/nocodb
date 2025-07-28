<script setup lang="ts">
import type { TableType, ViewType } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    label: string
    tableId: string
    viewId?: string
    modelValue: Row
    disabled?: boolean
    fields?: string[]
    version?: 'v3' | 'v2'
    allowRecordCreation?: boolean
    records?: Row[]
  }>(),
  {
    label: '- select a record -',
    version: 'v2',
  },
)

const emits = defineEmits<{
  'update:modelValue': (value: Row) => void
}>()

const { internalApi } = useApi()

const searchQuery = ref('')

const debouncedSearch = refDebounced(searchQuery, 200)

const ncRecordPickerDropdownRef = ref<HTMLDivElement>()

const vModel = useVModel(props, 'modelValue', emits)

const randomClass = `record_picker_${Math.floor(Math.random() * 99999)}`

const isOpen = ref(false)

const addOrRemoveClass = (add = false) => {
  const dropdownRoot = ncRecordPickerDropdownRef.value?.parentElement?.parentElement?.parentElement?.parentElement as HTMLElement
  if (dropdownRoot) {
    if (add) {
      dropdownRoot.classList.add('inset-0', 'nc-record-picker-dropdown-root', `nc-root-${randomClass}`)
    } else {
      dropdownRoot.classList.remove('inset-0', 'nc-record-picker-dropdown-root', `nc-root-${randomClass}`)
    }
  }
}

watch(
  isOpen,
  (next) => {
    if (next) {
      onClickOutside(document.querySelector(`.${randomClass}`)! as HTMLDivElement, (e) => {
        const targetEl = e?.target as HTMLElement

        if (!targetEl?.classList.contains(`nc-root-${randomClass}`) || targetEl?.closest(`.nc-${randomClass}`)) {
          return
        }
        isOpen.value = false

        addOrRemoveClass(false)
      })
    } else {
      addOrRemoveClass(false)
    }
  },
  { flush: 'post' },
)

watch([ncRecordPickerDropdownRef, isOpen], () => {
  if (!ncRecordPickerDropdownRef.value) return

  if (isOpen.value) {
    addOrRemoveClass(true)
  } else {
    addOrRemoveClass(false)
  }
})

const { getMeta } = useMetas()

const { viewsByTable } = storeToRefs(useViewsStore())
const { loadViews } = useViewsStore()

const viewMeta = ref<ViewType>()

const tableMeta = ref<TableType>()

const isLoading = ref(false)

const loadMetas = async () => {
  if (!props.tableId) return
  isLoading.value = true

  tableMeta.value = (await getMeta(props.tableId))!

  if (props.viewId) {
    viewMeta.value = viewsByTable.value.get(props.tableId)?.find((v) => v.id === props.viewId)

    if (!viewMeta.value) {
      await loadViews({ tableId: props.tableId, force: true })
      viewMeta.value = viewsByTable.value.get(props.tableId)?.find((v) => v.id === props.viewId)
    }
  } else {
    await loadViews({ tableId: props.tableId, force: true })
    viewMeta.value = viewsByTable.value.get(props.tableId)?.find((v) => v.is_default)
  }
  isLoading.value = false
}

onMounted(async () => {
  await loadMetas()
})

provide(MetaInj, tableMeta)

const displayField = computed(() => (tableMeta?.value?.columns ?? []).find((c) => c.pv))

const localState = ref()
const resolveInput = async (row: Row) => {
  localState.value = row
  if (props.version === 'v2') {
    vModel.value = row
  } else {
    const rowId = extractPkFromRow(row?.row, tableMeta?.value?.columns ?? [])
    try {
      const data = await internalApi.dbDataTableRowRead(tableMeta?.value?.base_id, tableMeta?.value?.id, rowId, {
        fields: props.fields,
      })
      vModel.value = data
    } catch (e) {
      console.error(e)
    }
  }

  isOpen.value = false
}

const filterQueryRef = ref<{ input: HTMLInputElement }>()

const recordsRef = ref()

const isValidSearchQuery = computed(() => {
  if (!recordsRef.value) return true

  return recordsRef.value?.isValidSearchQuery
})

whenever(isOpen, () => {
  if (!isOpen.value) return
  setTimeout(() => {
    filterQueryRef.value?.input.focus()
  }, 300)
})
</script>

<template>
  <NcDropdown
    v-model:visible="isOpen"
    :disabled="props.disabled"
    :trigger="['click']"
    :class="`.nc-${randomClass}`"
    :overlay-class-name="`nc-record-picker-dropdown overflow-hidden !min-w-[540px] xs:(!min-w-[90vw]) ${isOpen ? 'active' : ''}`"
  >
    <NcButton
      type="secondary"
      size="small"
      :disabled="disabled"
      icon-position="right"
      full-width
      :class="{ 'record-picker-active': isOpen, '!bg-[#F5F5F5]': disabled }"
      class="!border-[#d9d9d9]"
    >
      <span v-if="displayField && localState?.row" class="truncate text-left !leading-[1.5]">
        <SmartsheetPlainCell :model-value="localState?.row[displayField.title]" :column="displayField" />
      </span>
      <span
        v-else
        :class="{
          'text-[rgba(0,0,0,.25)]': disabled,
        }"
        class="truncate text-left !leading-[1.5]"
      >
        {{ props.label }}
      </span>

      <template #icon>
        <GeneralIcon :icon="isOpen ? 'arrowUp' : 'arrowDown'" class="self-center text-gray-700" />
      </template>
    </NcButton>

    <template #overlay>
      <div ref="ncRecordPickerDropdownRef" :class="`${randomClass}`" class="nc-record-picker-dropdown-wrapper">
        <div class="flex flex-col h-full w-full" :class="{ active: isOpen }" @keydown.enter.stop>
          <div class="bg-gray-100 py-2 rounded-t-xl flex justify-between pl-3 pr-2 gap-2">
            <div class="flex-1 nc-record-picker-dropdown-record-search-wrapper flex items-center py-0.5 rounded-md">
              <a-input
                ref="filterQueryRef"
                v-model:value="searchQuery"
                :bordered="false"
                placeholder="Search records..."
                class="w-full min-h-4 !pl-0"
                size="small"
              >
                <template #prefix>
                  <GeneralIcon icon="search" class="nc-search-icon mr-2 h-4 w-4 text-gray-500" />
                </template>
                <template v-if="!isValidSearchQuery" #suffix>
                  <NcTooltip :title="$t('msg.error.invalidSearchQueryForVisibleFields')" class="flex">
                    <GeneralIcon icon="ncInfo" class="flex-noneh-4 w-4 text-nc-content-red-medium" />
                  </NcTooltip>
                </template>
              </a-input>
            </div>
          </div>
          <NRecordPickerRecords
            v-if="!isLoading"
            ref="recordsRef"
            :view-meta="viewMeta"
            :data="records"
            :fields="fields"
            :meta="tableMeta"
            :where="debouncedSearch"
            @resolve="resolveInput"
          />
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.nc-record-picker-dropdown {
  @apply rounded-xl !border-gray-200;
  z-index: 1000 !important;
}
.nc-record-picker-dropdown-wrapper {
  @apply h-[412px] w-[540px] xs:(w-[90vw] min-h-[312px] h-[312px]);
  overflow-y: auto;
  overflow-x: hidden;
  resize: vertical;
  min-height: 412px;
  max-height: 600px;
  max-width: 540px;
}

.nc-record-picker-dropdown-root {
  z-index: 1000;
}

.nc-record-picker-dropdown-record-search-wrapper {
  .nc-search-icon {
    @apply flex-none text-gray-500;
  }

  &:focus-within {
    .nc-search-icon {
      @apply text-gray-600;
    }
  }
  input {
    @apply !caret-nc-fill-primary;
    &::placeholder {
      @apply text-gray-500;
    }
  }
}
.record-picker-active {
  @apply !border-nc-fill-primary;
  box-shadow: 0px 0px 0px 2px rgba(51, 102, 255, 0.24) !important;
}
</style>
