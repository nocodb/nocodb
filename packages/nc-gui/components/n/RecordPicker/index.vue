<script setup lang="ts">
import type { TableType, ViewType } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    label: string
    tableId: string
    viewId?: string
    modelValue: Row
    fields?: string[]
    allowRecordCreation?: boolean
    records?: Row[]
  }>(),
  {
    label: '- select a record -',
  },
)

const emits = defineEmits<{
  'update:modelValue': (value: Row) => void
}>()

const searchQuery = ref('')

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

const resolveInput = (row: Row) => {
  vModel.value = row
  isOpen.value = false
}
</script>

<template>
  <NcDropdown
    v-model:visible="isOpen"
    :trigger="['click']"
    :class="`.nc-${randomClass}`"
    :overlay-class-name="`nc-record-picker-dropdown !min-w-[540px] xs:(!min-w-[90vw]) ${isOpen ? 'active' : ''}`"
  >
    <NcButton type="secondary" size="small" icon-position="right" full-width>
      <span class="truncate text-left">{{ props.label }}</span>
      <template #icon>
        <GeneralIcon :icon="isOpen ? 'arrowUp' : 'arrowDown'" />
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
              </a-input>
            </div>
          </div>
          <NRecordPickerRecords
            v-if="!isLoading"
            :view-meta="viewMeta"
            :data="records"
            :fields="fields"
            :meta="tableMeta"
            :where="searchQuery"
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
</style>
