<script setup lang="ts">
import { PageDesignerPayloadInj, PageDesignerRowInj } from '../lib/context'
import { PageOrientation, PageType } from '../lib/layout'
import { type PageDesignerWidget, PageDesignerWidgetFactory, PageDesignerWidgetType } from '../lib/widgets'
import TextWidgetImage from '../assets/text-widget.svg'
import ImageWidgetImage from '../assets/image-widget.svg'
import DividerWidgetImage from '../assets/divider-widget.svg'
import StaticWidget from './StaticWidget.vue'
import GroupedSettings from './GroupedSettings.vue'
import TableAndViewPicker from './TableAndViewPicker.vue'
import FieldElements from './FieldElements.vue'
import RecordSelector from './RecordSelector.vue'

const payload = inject(PageDesignerPayloadInj)!
const row = inject(PageDesignerRowInj)!

const pageTypeOptions = Object.values(PageType)

const pageOrientationOptions = Object.values(PageOrientation)

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
          <label>Record</label>
          <RecordSelector />
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Add Elements">
      <div class="flex flex-col gap-4">
        <span class="text-nc-content-gray-subtle2 font-500">Drag and drop elements into the edit area.</span>
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
      <div v-if="row" class="flex flex-col gap-2">
        <label>Field Elements</label>
        <FieldElements />
      </div>
    </GroupedSettings>
    <GroupedSettings title="Page Settings">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label>Page Name</label>
          <a-input v-model:value="payload.pageName" placeholder="Page Name"></a-input>
        </div>
        <div class="flex flex-col gap-2">
          <label>Size</label>
          <NcSelect v-model:value="payload.pageType">
            <a-select-option v-for="pageType of pageTypeOptions" :key="pageType" :value="pageType">
              {{ pageType }}
            </a-select-option>
          </NcSelect>
        </div>
        <div class="flex flex-col gap-2">
          <label>Layout</label>
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
