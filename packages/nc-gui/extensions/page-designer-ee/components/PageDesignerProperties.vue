<script setup lang="ts">
import { PageDesignerPayloadInj } from '../lib/context'
import { PageOrientation, PageType } from '../lib/layout'
import { type PageDesignerWidget, PageDesignerWidgetFactory } from '../lib/widgets'
import GroupedSettings from './GroupedSettings.vue'

const payload = inject(PageDesignerPayloadInj)!

const pageTypeOptions = Object.values(PageType)

const pageOrientationOptions = Object.values(PageOrientation)

function addWidget(widget: PageDesignerWidget) {
  payload.value.widgets.push(widget)
}
</script>

<template>
  <div v-if="payload" class="flex flex-col page-properties overflow-y-auto max-h-full pb-8">
    <header>
      <h1 class="m-0">Page</h1>
    </header>
    <GroupedSettings title="Preview"> </GroupedSettings>
    <GroupedSettings title="Add Elements">
      <NcButton @click="addWidget(PageDesignerWidgetFactory.createEmptyTextWidget())">Text</NcButton>
      <NcButton @click="addWidget(PageDesignerWidgetFactory.createEmptyImageWidget())">Image</NcButton>
    </GroupedSettings>
    <GroupedSettings title="Page Settings">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <span>Page Name</span>
          <a-input v-model:value="payload.pageName" placeholder="Page Name" class="!rounded-lg"></a-input>
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

<style lang="scss" scoped>
.page-properties {
  header {
    h1 {
      font-size: 20px;
      font-weight: 700;
      line-height: 32px;
      letter-spacing: -0.4px;
      padding: 16px 24px;
      border-bottom: 1px solid;
      @apply border-nc-border-gray-medium;
    }
  }
  :deep(.ant-select-selection-item) {
    display: inline-block !important;
  }
  .border-inputs {
    .ant-input {
      @apply !rounded-lg h-8 w-8 text-center;
      padding: 2px;
      -moz-appearance: textfield; /*For FireFox*/

      &::-webkit-inner-spin-button {
        /*For Webkits like Chrome and Safari*/
        -webkit-appearance: none;
        margin: 0;
      }
    }
  }
  .radio-picker {
    border-radius: 0.5rem;
    :first-child {
      border-radius: 0.5rem 0 0 0.5rem;
    }
    :last-child {
      border-radius: 0 0.5rem 0.5rem 0;
    }
  }
}
</style>
