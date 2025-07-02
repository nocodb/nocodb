<script setup lang="ts">
import GroupedSettings from '../../Common/GroupedSettings.vue'

const emit = defineEmits<{
  'update:appearance': [source: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const appearanceType = ref(selectedWidget.value?.config?.appearance?.type || 'default')

const onAppearanceTypeChange = () => {
  emit('update:appearance', {
    type: appearanceType.value,
  })
}
</script>

<template>
  <GroupedSettings title="Colour">
    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <a-radio-group v-model:value="appearanceType" class="appearance-type w-full" @update:value="onAppearanceTypeChange">
        <a-radio value="default">Default</a-radio>
        <a-radio value="filled">Filled</a-radio>
        <a-radio value="coloured">Coloured text</a-radio>
      </a-radio-group>
    </div>
  </GroupedSettings>
</template>

<style scoped lang="scss">
.appearance-type {
  :deep(.ant-radio-input:focus + .ant-radio-inner) {
    box-shadow: none !important;
  }
  :deep(.ant-radio-wrapper) {
    > span {
      @apply text-nc-content-gray leading-5;
    }
    @apply flex py-2 m-0;
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
</style>
