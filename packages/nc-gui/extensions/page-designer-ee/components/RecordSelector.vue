<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  tableId: string
  viewId: string
}>()

const { getMeta } = useMetas()

const isOpenSelectRecordDropdown = ref(false)
const selectedRecordPk = defineModel<string>()
const meta = ref<TableType | null>(null)

const { getData } = useExtensionHelperOrThrow()

const isLoadingViewData = ref(false)

const columns = computed(() => meta.value?.columns)

const displayField = computed(() => columns.value?.find((c) => c?.pv) || columns.value?.[0] || null)

const records = ref<Record<string, any>[]>([])

const sampleRecords = computed<
  {
    label: any
    value: any
    row: any
  }[]
>(() => {
  return records.value
    .map((row) => {
      const pk = extractPkFromRow(row, columns.value || [])
      const displayValue = row?.[displayField.value?.title]

      return {
        label: displayValue,
        value: pk,
        row,
      }
    })
    .filter((r) => !!(r.label && r.value))
})

const selectedRecord = computed(() => {
  return (
    sampleRecords.value.find((r) => r.value === selectedRecordPk.value) || {
      row: {
        row: {},
        oldRow: {},
        rowMeta: { new: true },
      },
      label: '',
      value: '',
    }
  )
})

const loadRecords = async () => {
  isLoadingViewData.value = !records.value
  const freshRecords: Record<string, any>[] = []
  await getData({
    tableId: props.tableId,
    viewId: props.viewId,
    eachPage: (records: Record<string, any>[], nextPage: () => void) => {
      freshRecords.push(...records)
      nextPage()
    },
    done: () => {},
  })
  records.value = freshRecords
  await ncDelay(250)
  isLoadingViewData.value = false
  if ((selectedRecordPk.value === '' || selectedRecordPk.value == null) && sampleRecords.value.length) {
    selectedRecordPk.value = sampleRecords.value[0].value
  }
}

watch(isOpenSelectRecordDropdown, (newValue) => {
  if (newValue) {
    loadRecords()
  }
})

watch(
  () => props.tableId,
  async (tableId) => {
    meta.value = await getMeta(tableId)
    loadRecords()
  },
  { immediate: true },
)
</script>

<template>
  <NcDropdown
    v-model:visible="isOpenSelectRecordDropdown"
    placement="bottom"
    overlay-class-name="overflow-hidden"
    class="m-3 -mt-3"
  >
    <NcButton
      size="small"
      class="flex-1 children:children:w-full !font-bold !text-sm"
      type="secondary"
      :class="{
        '!text-gray-900 !bg-gray-100': isOpenSelectRecordDropdown,
      }"
      @click.stop
    >
      <NcTooltip v-if="selectedRecordPk && displayField" class="w-full text-left truncate !leading-6" show-on-truncate-only>
        <template #title>
          <LazySmartsheetPlainCell v-model="selectedRecord.row[displayField.title]" :column="displayField" class="!leading-6" />
        </template>

        <LazySmartsheetPlainCell v-model="selectedRecord.row[displayField.title]" :column="displayField" class="!leading-6" />
      </NcTooltip>
      <div v-else class="flex-1 flex items-center gap-2">- Select Record -</div>
      <GeneralLoader v-if="isLoadingViewData && !isOpenSelectRecordDropdown" size="regular" />
      <GeneralIcon
        v-else
        icon="chevronDown"
        class="!text-current opacity-70 flex-none transform transition-transform duration-250 w-4 h-4 ml-1"
        :class="{ '!rotate-180': isOpenSelectRecordDropdown }"
      />
    </NcButton>

    <template #overlay>
      <div
        v-if="isLoadingViewData"
        class="min-w-[500px] max-w-[576px] min-h-[296px] relative flex flex-col items-center justify-center gap-2 min-h-25 text-nc-content-brand"
      >
        <GeneralLoader size="large" class="flex-none" />
        Loading records
      </div>
      <NcList
        v-else
        v-model:value="selectedRecordPk"
        v-model:open="isOpenSelectRecordDropdown"
        :list="sampleRecords"
        show-search-always
        search-input-placeholder="Search records"
        :item-height="60"
        class="!w-auto min-w-[550px] max-w-[550px]"
        container-class-name="!px-0 !pb-0"
        item-class-name="!rounded-none !p-0 !bg-none !hover:bg-none"
      >
        <template #listItem="{ option, isSelected }">
          <NcListRecordItem
            :row="option || {}"
            :columns="columns || []"
            :is-selected="isSelected"
            class="!cursor-pointer"
            display-value-class-name="!text-nc-content-gray"
          />
        </template>
      </NcList>
    </template>
  </NcDropdown>
</template>
