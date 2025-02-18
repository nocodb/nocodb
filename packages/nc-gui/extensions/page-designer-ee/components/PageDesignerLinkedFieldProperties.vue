<script setup lang="ts">
import { PageDesignerPayloadInj, PageDesignerRowInj } from '../lib/context'
import { LinkedFieldDisplayAs, type PageDesignerLinkedFieldWidget, LinkedFieldListType } from '../lib/widgets'
import GroupedSettings from './GroupedSettings.vue'
import ColorPropertyPicker from './ColorPropertyPicker.vue'
import TabbedSelect from './TabbedSelect.vue'
import { type ColumnType, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import FieldElement from './FieldElement.vue'
import RelatedFieldsSelector from './RelatedFieldsSelector.vue'
import Draggable from 'vuedraggable'
import BorderSettings from './BorderSettings.vue'

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

const columns = computed(() => relatedTableMeta.value.columns?.filter((col) => !isSystemColumn(col) && !isLinksOrLTAR(col)) ?? [])
const columnsMapById = computed(() =>
  columns.value.reduce((map, col) => {
    map[col.id!] = col
    return map
  }, {} as Record<string, Record<string, any>>),
)

onMounted(() => {
  loadRelatedTableMeta()
})

watch(
  columns,
  (val) => {
    if (fieldWidget.value && !fieldWidget.value.tableColumns.length) {
      const pvCol = val.find((col) => col.pv)
      if (pvCol) fieldWidget.value.tableColumns.push(pvCol.id!)
    }
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <div v-if="fieldWidget" class="flex flex-col text-properties overflow-y-auto max-h-full pb-8">
    <header class="widget-header">
      <h1 class="m-0 flex items-center gap-3 flex-wrap">
        Link Fields
        <div class="flex items-center px-2 py-1 gap-2 bg-nc-bg-gray-medium rounded-lg">
          <component :is="getIcon(fieldWidget.field)" class="!m-0" />
          <span class="text-[14px] font-medium text-nc-content-gray-subtle2">{{ fieldWidget.field.title }}</span>
        </div>
        <div class="flex-1"></div>
        <span class="text-[13px] -mt-1 font-medium text-nc-content-gray-subtle2"
          >Display Linked fields Inline, as a list or in a tabular format.</span
        >
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
      <div v-else-if="fieldWidget.displayAs === LinkedFieldDisplayAs.TABLE" class="flex flex-col gap-2">
        <label>Table columns</label>
        <div class="rounded-lg border-1 border-nc-border-gray-medium overflow-hidden">
          <RelatedFieldsSelector v-model="fieldWidget.tableColumns" :related-table-meta="relatedTableMeta" />
          <Draggable v-model="fieldWidget.tableColumns" :item-key="(id: string) => id" handle=".cursor-move">
            <template #item="{ element: fieldId }">
              <FieldElement
                class="table-column-field-element"
                :icon="getIcon(columnsMapById[fieldId]!)"
                :field="columnsMapById[fieldId]!"
                display-drag-handle
              />
            </template>
          </Draggable>
        </div>
      </div>
    </GroupedSettings>

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
