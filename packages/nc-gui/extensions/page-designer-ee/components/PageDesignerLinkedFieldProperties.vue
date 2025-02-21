<script setup lang="ts">
import { PageDesignerPayloadInj, PageDesignerRowInj } from '../lib/context'
import { LinkedFieldDisplayAs, type PageDesignerLinkedFieldWidget, LinkedFieldListType } from '../lib/widgets'
import GroupedSettings from './GroupedSettings.vue'
import ColorPropertyPicker from './ColorPropertyPicker.vue'
import TabbedSelect from './TabbedSelect.vue'
import { type ColumnType, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import RelatedFieldsSelector from './RelatedFieldsSelector.vue'
import BorderSettings from './BorderSettings.vue'
import { type PageDesignerTextWidget, fontWeightToLabel, fontWeights, fonts } from '../lib/widgets'
import NonNullableNumberInput from './NonNullableNumberInput.vue'

const payload = inject(PageDesignerPayloadInj)!
const row = inject(PageDesignerRowInj)! as Ref<Row>

const fieldWidget = ref<PageDesignerLinkedFieldWidget>()
watch(
  () => payload.value.currentWidgetId,
  (id) => {
    fieldWidget.value = payload?.value?.widgets[id] as PageDesignerLinkedFieldWidget
  },
  { immediate: true },
)

const column = computed(() => fieldWidget.value!.field as Required<ColumnType>)

const isNew = ref(false)

const { relatedTableMeta, loadRelatedTableMeta } = useProvideLTARStore(column, row, isNew)

const displayAsOptionsMap = {
  [LinkedFieldDisplayAs.INLINE]: iconMap.ncAlignLeft,
  [LinkedFieldDisplayAs.LIST]: iconMap.ncList,
  [LinkedFieldDisplayAs.TABLE]: iconMap.table,
}
const getIcon = (c: ColumnType) =>
  h(isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: c,
  })

const relatedColumns = computed(
  () => relatedTableMeta.value.columns?.filter((col) => !isSystemColumn(col) && !isLinksOrLTAR(col)) ?? [],
)

onMounted(() => {
  loadRelatedTableMeta()
})

const tableColumnsIdMap = computed(() =>
  (fieldWidget.value?.tableColumns ?? []).reduce((map, col) => {
    map[col.id] = col
    return map
  }, {} as Record<string, { id: string; selected: boolean }>),
)

watch(
  relatedColumns,
  (val) => {
    if (!fieldWidget.value) return
    let tableColumns = [...fieldWidget.value.tableColumns]
    // add new column
    for (const col of val) {
      if (!tableColumnsIdMap.value[col.id!]) tableColumns.push({ id: col.id!, selected: false })
    }
    const colIdSet = new Set(val.map((col) => col.id!))
    // remove deleted column
    tableColumns = tableColumns.filter((col) => colIdSet.has(col.id))
    fieldWidget.value.tableColumns = tableColumns
  },
  { immediate: true, deep: true },
)

watch(
  () => fieldWidget.value?.displayAs,
  (val) => {
    if (!fieldWidget.value) return
    const { borderTop, borderBottom, borderLeft, borderRight } = fieldWidget.value
    if (val === LinkedFieldDisplayAs.TABLE && [borderTop, borderBottom, borderLeft, borderRight].every((val) => val === '0')) {
      fieldWidget.value.borderTop = '1'
      fieldWidget.value.borderBottom = '1'
      fieldWidget.value.borderLeft = '1'
      fieldWidget.value.borderRight = '1'
    }
  },
)

const isTable = computed(() => fieldWidget.value?.displayAs === LinkedFieldDisplayAs.TABLE)
</script>

<template>
  <div v-if="fieldWidget" class="flex flex-col properties overflow-y-auto max-h-full">
    <header class="widget-header">
      <h1 class="m-0 flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-3">
          <component :is="getIcon(fieldWidget.field)" class="!h-5 !w-5 !m-0" style="stroke-width: 1.66px" />
          {{ fieldWidget.field.title }}
        </div>
        <div class="flex-1"></div>
        <span class="text-[13px] -mt-1 font-medium text-nc-content-gray-subtle2">
          Display Linked fields Inline, as a list or in a tabular format.
        </span>
      </h1>
    </header>
    <GroupedSettings title="Display as">
      <TabbedSelect
        v-model="fieldWidget.displayAs"
        :values="[LinkedFieldDisplayAs.INLINE, LinkedFieldDisplayAs.LIST, LinkedFieldDisplayAs.TABLE]"
      >
        <template #default="{ value }">
          <div class="flex gap-2 items-center">
            <component :is="displayAsOptionsMap[value as LinkedFieldDisplayAs]" />
            <span>{{ value }}</span>
          </div>
        </template>
      </TabbedSelect>
      <div v-if="fieldWidget.displayAs === LinkedFieldDisplayAs.LIST">
        <a-radio-group v-model:value="fieldWidget.listType" class="field-list-type w-full">
          <a-radio :value="LinkedFieldListType.Bullet">{{ LinkedFieldListType.Bullet }}</a-radio>
          <a-radio :value="LinkedFieldListType.Number">{{ LinkedFieldListType.Number }}</a-radio>
        </a-radio-group>
      </div>
      <div v-else-if="isTable" class="flex flex-col gap-2">
        <label>Table columns</label>
        <div class="rounded-lg border-1 border-nc-border-gray-medium overflow-hidden">
          <RelatedFieldsSelector v-model="fieldWidget.tableColumns" :related-table-meta="relatedTableMeta" />
        </div>
      </div>
    </GroupedSettings>

    <template v-if="isTable">
      <GroupedSettings title="Font settings">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Font</label>
          <NcSelect v-model:value="fieldWidget.fontFamily" show-search>
            <a-select-option v-for="font of fonts" :key="font" :value="font">
              <span :style="{ fontFamily: font }">{{ font }}</span>
            </a-select-option>
          </NcSelect>
        </div>

        <div class="flex gap-3">
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <label>Size</label>
            <NonNullableNumberInput
              v-model="fieldWidget.tableFontSettings.row.fontSize"
              :reset-to="12"
              :min="1"
              class="flex-1"
              placeholder="12"
            />
          </div>
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <label>Line Height</label>
            <NonNullableNumberInput
              v-model="fieldWidget.tableFontSettings.row.lineHeight"
              :reset-to="1.5"
              :min="1"
              class="flex-1"
              placeholder="1.5"
            />
          </div>
        </div>
        <div class="flex gap-3">
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <label>Color</label>
            <ColorPropertyPicker v-model="fieldWidget.tableFontSettings.row.textColor" />
          </div>
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <label>Weight</label>
            <NcSelect v-model:value="fieldWidget.tableFontSettings.row.fontWeight">
              <a-select-option v-for="weight of fontWeights" :key="weight" :value="weight">
                <span :style="{ fontWeight: weight }"> {{ fontWeightToLabel[weight] }}</span>
              </a-select-option>
            </NcSelect>
          </div>
        </div>

        <span class="text-[14px] font-700 mt-3 leading-[20px]">Table header</span>

        <div class="flex gap-3">
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <label>Size</label>
            <NonNullableNumberInput
              v-model="fieldWidget.tableFontSettings.header.fontSize"
              :reset-to="12"
              :min="1"
              class="flex-1"
              placeholder="12"
            />
          </div>
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <label>Line Height</label>
            <NonNullableNumberInput
              v-model="fieldWidget.tableFontSettings.header.lineHeight"
              :reset-to="1.5"
              :min="1"
              class="flex-1"
              placeholder="1.5"
            />
          </div>
        </div>
        <div class="flex gap-3">
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <label>Color</label>
            <ColorPropertyPicker v-model="fieldWidget.tableFontSettings.header.textColor" />
          </div>
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <label>Weight</label>
            <NcSelect v-model:value="fieldWidget.tableFontSettings.header.fontWeight">
              <a-select-option v-for="weight of fontWeights" :key="weight" :value="weight">
                <span :style="{ fontWeight: weight }"> {{ fontWeightToLabel[weight] }}</span>
              </a-select-option>
            </NcSelect>
          </div>
        </div>
      </GroupedSettings>
    </template>

    <BorderSettings
      v-model:border-top="fieldWidget.borderTop"
      v-model:border-bottom="fieldWidget.borderBottom"
      v-model:border-left="fieldWidget.borderLeft"
      v-model:border-right="fieldWidget.borderRight"
      v-model:border-radius="fieldWidget.borderRadius"
      v-model:border-color="fieldWidget.borderColor"
    />

    <GroupedSettings title="Fill">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Background Color</label>
          <ColorPropertyPicker v-model="fieldWidget.backgroundColor" />
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <label>Text Color</label>
          <ColorPropertyPicker v-model="fieldWidget.textColor" />
        </div>
      </div>
    </GroupedSettings>
  </div>
</template>

<style lang="scss" scoped>
.field-list-type {
  :deep(.ant-radio-input:focus + .ant-radio-inner) {
    box-shadow: none !important;
  }
  :deep(.ant-radio-wrapper) {
    @apply flex px-4 py-2 border-1 border-nc-gray-medium m-0;
    .ant-radio-checked .ant-radio-inner {
      @apply !bg-nc-fill-primary !border-nc-fill-primary;
      &::after {
        @apply bg-nc-bg-default;
        width: 12px;
        height: 12px;
        margin-top: -6px;
        margin-left: -6px;
      }
    }
    &:first-child {
      @apply rounded-tl-lg rounded-tr-lg;
    }
    &:last-child {
      @apply border-t-0 rounded-bl-lg rounded-br-lg;
    }
  }
}
.table-column-field-element :deep(.truncate) {
  font-weight: 700;
}
</style>
