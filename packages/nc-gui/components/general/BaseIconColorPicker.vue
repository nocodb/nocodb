<script lang="ts" setup>
import tinycolor from 'tinycolor2'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    size?: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge'
    readonly?: boolean
    iconClass?: string
  }>(),
  {
    size: 'small',
    iconClass: '',
  },
)

const emit = defineEmits(['update:modelValue'])

const { modelValue, readonly } = toRefs(props)
const { size } = props

const isOpen = ref(false)

const colorRef = ref(tinycolor(modelValue.value).isValid() ? modelValue.value : baseIconColors[0])

const updateIconColor = (color: string) => {
  const tcolor = tinycolor(color)
  if (tcolor.isValid()) {
    colorRef.value = color
  }
}

const onClick = (e: Event) => {
  if (readonly.value) return

  e.stopPropagation()

  isOpen.value = !isOpen.value
}

watch(
  isOpen,
  (value) => {
    if (!value && colorRef.value !== modelValue.value) {
      emit('update:modelValue', colorRef.value)
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div>
    <NcDropdown
      v-model:visible="isOpen"
      :trigger="['click']"
      :disabled="readonly"
      overlay-class-name="overflow-hidden max-w-[342px]"
    >
      <div
        class="flex flex-row justify-center items-center select-none rounded nc-base-icon-picker-trigger"
        :class="{
          'hover:bg-gray-500 hover:bg-opacity-15 cursor-pointer': !readonly,
          'bg-gray-500 bg-opacity-15': isOpen,
          'h-5 w-5 text-base': size === 'xsmall',
          'h-6 w-6 text-lg': size === 'small',
          'h-8 w-8 text-xl': size === 'medium',
          'h-10 w-10 text-2xl': size === 'large',
          'h-14 w-16 text-5xl': size === 'xlarge',
        }"
        @click="onClick"
      >
        <NcTooltip placement="topLeft" :disabled="readonly || isOpen">
          <template #title> {{ $t('tooltip.changeIconColour') }} </template>

          <div>
            <GeneralProjectIcon :color="colorRef" :class="iconClass" />
          </div>
        </NcTooltip>
      </div>

      <template #overlay>
        <div class="nc-base-icon-color-picker-dropdown relative bg-white">
          <div class="flex justify-start">
            <GeneralColorPicker
              :model-value="colorRef"
              :colors="baseIconColors"
              :is-new-design="true"
              class="nc-base-icon-color-picker"
              @input="updateIconColor"
            />
          </div>
        </div>
      </template>
    </NcDropdown>
  </div>
</template>
