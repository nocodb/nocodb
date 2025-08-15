<script setup lang="ts">
import { TextWidgetTypes } from 'nocodb-sdk'
import GroupedSettings from '~/components/smartsheet/dashboard/widgets/common/GroupedSettings.vue'

const emit = defineEmits<{
  'update:formatting': [category: any]
}>()

const { selectedWidget: textWidget } = storeToRefs(useWidgetStore())

const horizontalAlign = ref(textWidget.value?.config?.formatting.horizontalAlign || 'flex-start')

const verticalAlign = ref(textWidget.value?.config?.formatting.verticalAlign || 'flex-start')

const bold = ref(textWidget.value?.config?.formatting.bold || false)

const italic = ref(textWidget.value?.config?.formatting.italic || false)

const underline = ref(textWidget.value?.config?.formatting.underline || false)

const strikeThrough = ref(textWidget.value?.config?.formatting.strikethrough || false)

const updateFormatting = () => {
  emit('update:formatting', {
    horizontalAlign: horizontalAlign.value,
    verticalAlign: verticalAlign.value,
    bold: bold.value,
    italic: italic.value,
    underline: underline.value,
    strikethrough: strikeThrough.value,
  })
}

watch(
  [bold, italic, underline, strikeThrough],
  () => {
    updateFormatting()
  },
  { deep: true },
)
</script>

<template>
  <GroupedSettings title="Formatting">
    <div class="flex gap-2 formatting">
      <div v-if="textWidget?.config?.type === TextWidgetTypes.Text" class="flex">
        <NcButton
          :shadow="false"
          size="small"
          type="secondary"
          class="!border-x-0 hover:!bg-nc-bg-gray-medium !border-y-0 !bg-nc-bg-gray-light !rounded-r-none"
          @click="bold = !bold"
        >
          <GeneralIcon icon="ncBold" :class="{ 'text-nc-content-brand-disabled': bold }" />
        </NcButton>
        <NcButton
          :shadow="false"
          size="small"
          type="secondary"
          class="!rounded-x-none hover:!bg-nc-bg-gray-medium !border-y-0 !bg-nc-bg-gray-light"
          @click="italic = !italic"
        >
          <GeneralIcon icon="ncItalic" :class="{ 'text-nc-content-brand-disabled': italic }" />
        </NcButton>
        <NcButton
          :shadow="false"
          size="small"
          type="secondary"
          class="!border-l-0 hover:!bg-nc-bg-gray-medium !border-r-0 !border-y-0 !rounded-l-none !bg-nc-bg-gray-light"
          @click="underline = !underline"
        >
          <GeneralIcon icon="ncUnderline" :class="{ 'text-nc-content-brand-disabled': underline }" />
        </NcButton>
      </div>

      <a-radio-group v-model:value="horizontalAlign" class="radio-pills" @update:value="updateFormatting">
        <a-radio-button value="flex-start">
          <GeneralIcon icon="ncAlignLeft" />
        </a-radio-button>
        <a-radio-button value="center">
          <GeneralIcon icon="ncAlignCenter" />
        </a-radio-button>
        <a-radio-button value="flex-end">
          <GeneralIcon icon="ncAlignRight" />
        </a-radio-button>
      </a-radio-group>

      <a-radio-group v-model:value="verticalAlign" class="radio-pills" @update:value="updateFormatting">
        <a-radio-button value="flex-start">
          <GeneralIcon icon="ncVerticalAlignTop" />
        </a-radio-button>
        <a-radio-button value="center">
          <GeneralIcon icon="ncVerticalAlignCenter" />
        </a-radio-button>
        <a-radio-button value="flex-end">
          <GeneralIcon icon="ncVerticalAlignBottom" />
        </a-radio-button>
      </a-radio-group>
    </div>
  </GroupedSettings>
</template>

<style scoped lang="scss">
.radio-pills {
  @apply rounded-lg;
  label.ant-radio-button-wrapper {
    @apply bg-nc-bg-gray-light !border-t-nc-border-gray-light !border-b-nc-border-gray-light !border-l-nc-border-gray-light !border-r-nc-border-gray-medium;
    @apply px-2 text-nc-content-gray-subtle;
    &.ant-radio-button-wrapper-checked {
      @apply !outline-none !shadow-none !text-nc-content-brand-disabled;
    }
    &:before {
      @apply !bg-transparent;
    }
  }
  > :first-child {
    @apply rounded-[8px_0_0_8px] !border-l-0;
  }
  > :last-child {
    @apply rounded-[0_8px_8px_0] !border-r-0;
  }
  > :hover {
    @apply !bg-nc-bg-gray-medium;
  }
  .nc-icon {
    @apply -mt-[2px];
  }
}
</style>
