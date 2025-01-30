<script setup lang="ts">
import { PageDesignerPayloadInj, PageDesignerRowInj, PageDesignerTableTypeInj } from '../lib/context'
import { PageOrientation, PageType } from '../lib/layout'
import { type PageDesignerWidget, PageDesignerWidgetFactory, PageDesignerWidgetType } from '../lib/widgets'
import TextWidgetImage from '../assets/text-widget.svg'
import ImageWidgetImage from '../assets/image-widget.svg'
import DividerWidgetImage from '../assets/divider-widget.svg'
import StaticWidget from './StaticWidget.vue'
import GroupedSettings from './GroupedSettings.vue'
import TableAndViewPicker from './TableAndViewPicker.vue'
import FieldElements from './FieldElements.vue'

const payload = inject(PageDesignerPayloadInj)!
const row = inject(PageDesignerRowInj)!
const meta = inject(PageDesignerTableTypeInj)

const pageTypeOptions = Object.values(PageType)

const pageOrientationOptions = Object.values(PageOrientation)

const displayField = computed(() => meta?.value?.columns?.find((c) => c?.pv) || meta?.value?.columns?.[0] || null)

function addWidget(widget: PageDesignerWidget) {
  PageDesignerWidgetFactory.create(payload, widget)
}

function print() {
  window.print()
}
</script>

<template>
  <div v-if="payload" class="flex flex-col page-properties overflow-y-auto max-h-full pb-8">
    <header class="widget-header flex w-full justify-between">
      <h1 class="m-0">Page</h1>
      <NcButton size="small" type="secondary" @click="print">
        <GeneralIcon icon="ncPrinter"></GeneralIcon>
      </NcButton>
    </header>
    <GroupedSettings title="Preview">
      <div class="flex flex-col gap-4">
        <TableAndViewPicker />
        <div class="flex flex-col gap-2">
          <span>Record</span>
          <NRecordPicker
            v-if="payload.selectedTableId"
            :key="payload.selectedTableId + payload.selectedViewId"
            v-model:model-value="row"
            :label="row ? row.row?.[displayField?.title ?? ''] ?? 'Select Record' : 'Select Record'"
            :table-id="payload.selectedTableId"
            :view-id="payload.selectedViewId"
            class="w-full page-designer-record-picker"
          />
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Add Elements">
      <div class="flex flex-col gap-4">
        <span>Drag and drop elements into the edit area.</span>
        <div class="flex">
          <StaticWidget
            :type="PageDesignerWidgetType.TEXT"
            :icon="TextWidgetImage"
            text="Text"
            first
            @click="addWidget(PageDesignerWidgetFactory.createEmptyTextWidget())"
          ></StaticWidget>
          <StaticWidget
            :type="PageDesignerWidgetType.IMAGE"
            :icon="ImageWidgetImage"
            text="Image"
            @click="addWidget(PageDesignerWidgetFactory.createEmptyImageWidget())"
          ></StaticWidget>
          <StaticWidget
            :type="PageDesignerWidgetType.DIVIDER"
            :icon="DividerWidgetImage"
            text="Divider"
            last
            @click="addWidget(PageDesignerWidgetFactory.createEmptyDividerWidget())"
          ></StaticWidget>
        </div>
      </div>
      <div v-if="row" class="flex flex-col gap-4">
        <span>Field Elements</span>
        <FieldElements />
      </div>
    </GroupedSettings>
    <GroupedSettings title="Page Settings">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <span>Page Name</span>
          <a-input v-model:value="payload.pageName" placeholder="Page Name"></a-input>
        </div>
        <div class="flex flex-col gap-2">
          <span>Size</span>
          <NcSelect v-model:value="payload.pageType">
            <a-select-option v-for="pageType of pageTypeOptions" :key="pageType" :value="pageType">
              {{ pageType }}
            </a-select-option>
          </NcSelect>
        </div>
        <div class="flex flex-col gap-2">
          <span>Layout</span>
          <NcSelect v-model:value="payload.orientation">
            <a-select-option v-for="orientation of pageOrientationOptions" :key="orientation" :value="orientation">
              {{ orientation }}
            </a-select-option>
          </NcSelect>
        </div>
      </div>
    </GroupedSettings>
  </div>
</template>
