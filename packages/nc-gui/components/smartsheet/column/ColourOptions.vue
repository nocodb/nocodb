<script setup lang="ts">
import { ColumnHelper, UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const { isDark, getColor } = useTheme()

const picked = computed({
  get: () => vModel.value.meta.color,
  set: (val) => {
    vModel.value.meta.color = val
  },
})

const isOpenColorPicker = ref(false)

// set default value
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.Colour),
  ...(vModel.value.meta || {}),
}

const iconColor = computed(() => {
  if (!isDark.value) return vModel.value.meta.color

  return getOppositeColorOfBackground(getColor('var(--nc-bg-default)'), vModel.value.meta.color, ['#4a5268', '#d5dce8'])
})

const displayFormatOptions = [
  { label: 'Color swatch + hex code', value: 'swatch_hex' },
  { label: 'Color swatch only', value: 'swatch_only' },
  { label: 'Hex code only', value: 'hex_only' },
]

const swatchStyleOptions = [
  { label: 'Circle', value: 'circle' },
  { label: 'Square', value: 'square' },
]

const swatchSizeOptions = [
  { label: 'Small (16px)', value: 'small' },
  { label: 'Medium (20px)', value: 'medium' },
  { label: 'Large (24px)', value: 'large' },
]
</script>

<template>
  <div class="w-full">
    <a-row :gutter="8">
      <a-col :span="12">
        <a-form-item :label="$t('labels.defaultColor')">
          <NcDropdown
            v-model:visible="isOpenColorPicker"
            placement="bottomLeft"
            :auto-close="false"
            class="nc-color-picker-dropdown-trigger"
          >
            <div
              class="flex-1 border-1 border-nc-border-gray-dark rounded-lg h-8 px-[11px] flex items-center justify-between transition-all cursor-pointer"
              :class="{
                'border-nc-border-brand shadow-selected': isOpenColorPicker,
              }"
            >
              <div class="flex-1 flex items-center gap-2">
                <div
                  class="w-5 h-5 rounded-full border-1 border-nc-border-gray-medium"
                  :style="{
                    backgroundColor: iconColor,
                  }"
                />
                <span class="text-sm text-nc-content-gray-emphasis">{{ picked || '#3366FF' }}</span>
              </div>

              <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle h-4 w-4" />
            </div>
            <template #overlay>
              <div>
                <LazyGeneralAdvanceColorPicker
                  v-model="picked"
                  :is-open="isOpenColorPicker"
                  @input="(el:string)=>vModel.meta.color=el"
                />
              </div>
            </template>
          </NcDropdown>
        </a-form-item>
      </a-col>
      <a-col :span="12">
        <a-form-item :label="$t('labels.displayFormat')">
          <a-select
            v-model:value="vModel.meta.displayFormat"
            data-testid="nc-dropdown-colour-display-format"
            class="w-full"
            dropdown-class-name="nc-dropdown-colour-display-format"
          >
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
            </template>

            <a-select-option v-for="option in displayFormatOptions" :key="option.value" :value="option.value">
              <div class="flex gap-2 w-full justify-between items-center nc-dropdown-option">
                {{ option.label }}
                <component
                  :is="iconMap.check"
                  v-if="vModel.meta.displayFormat === option.value"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
    </a-row>

    <a-row :gutter="8">
      <a-col :span="12">
        <a-form-item :label="$t('labels.swatchStyle')">
          <a-select
            v-model:value="vModel.meta.swatchStyle"
            data-testid="nc-dropdown-colour-swatch-style"
            class="w-full"
            dropdown-class-name="nc-dropdown-colour-swatch-style"
          >
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
            </template>

            <a-select-option v-for="option in swatchStyleOptions" :key="option.value" :value="option.value">
              <div class="flex gap-2 w-full justify-between items-center nc-dropdown-option">
                {{ option.label }}
                <component
                  :is="iconMap.check"
                  v-if="vModel.meta.swatchStyle === option.value"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
      <a-col :span="12">
        <a-form-item :label="$t('labels.swatchSize')">
          <a-select
            v-model:value="vModel.meta.swatchSize"
            data-testid="nc-dropdown-colour-swatch-size"
            class="w-full"
            dropdown-class-name="nc-dropdown-colour-swatch-size"
          >
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
            </template>

            <a-select-option v-for="option in swatchSizeOptions" :key="option.value" :value="option.value">
              <div class="flex gap-2 w-full justify-between items-center nc-dropdown-option">
                {{ option.label }}
                <component
                  :is="iconMap.check"
                  v-if="vModel.meta.swatchSize === option.value"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
    </a-row>
  </div>
</template>

<style scoped lang="scss">
.color-selector:hover {
  @apply brightness-90;
}

.color-selector.selected {
  @apply py-[5px] px-[10px] brightness-90;
}
</style>