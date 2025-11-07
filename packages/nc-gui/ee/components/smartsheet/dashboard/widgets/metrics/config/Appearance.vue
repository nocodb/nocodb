<script setup lang="ts">
import GroupedSettings from '../../common/GroupedSettings.vue'
import { colorColoured, colorFilled } from './color'

const emit = defineEmits<{
  'update:appearance': [source: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const appearanceType = ref(selectedWidget.value?.config?.appearance?.type || 'default')

const appearanceTheme = ref(selectedWidget.value?.config?.appearance?.theme || 'gray')

const onAppearanceTypeChange = () => {
  emit('update:appearance', {
    type: appearanceType.value,
  })
}

const onAppearanceThemeChange = (color: string) => {
  appearanceTheme.value = color
  emit('update:appearance', {
    theme: color,
  })
}

const colors = computed(() => {
  if (appearanceType.value === 'coloured') {
    return colorColoured
  } else if (appearanceType.value === 'filled') {
    return colorFilled
  }
  return []
})
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

    <div v-if="appearanceType !== 'default'" class="grid grid-cols-3 gap-2">
      <div
        v-for="color in colors"
        :key="color.value"
        class="flex flex-col border-2 rounded-lg cursor-pointer gap-2 p-4"
        :class="{
          'border-nc-fill-primary rounded-lg': color.id === appearanceTheme,
          'border-nc-bg-default': color.id !== appearanceTheme,
        }"
        @click="onAppearanceThemeChange(color.id)"
      >
        <div
          :style="{ backgroundColor: color.fill }"
          class="px-3 py-2 rounded-lg flex flex-col text-captionBold items-center justify-center"
        >
          123
        </div>
        <div :style="{ color: color.color }" class="text-xs text-nc-content-gray text-caption text-center">
          {{ color.title }}
        </div>
      </div>
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
