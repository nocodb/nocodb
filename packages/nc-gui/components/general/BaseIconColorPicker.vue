<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import { NcProjectType } from '#imports'

const props = withDefaults(
  defineProps<{
    type?: typeof NcProjectType | string
    modelValue?: string
    size?: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge'
    readonly?: boolean
    iconClass?: string
  }>(),
  {
    type: NcProjectType.DB,
    size: 'small',
  },
)

const emit = defineEmits(['update:modelValue'])

const { modelValue } = toRefs(props)
const { size, readonly } = props

const isOpen = ref(false)

const colorRef = ref(tinycolor(modelValue.value).isValid() ? modelValue.value : baseIconColors[0])

const updateIconColor = (color: string) => {
  const tcolor = tinycolor(color)
  if (tcolor.isValid()) {
    colorRef.value = color
  }
}

const onClick = (e: Event) => {
  if (readonly) return

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
    <a-dropdown v-model:visible="isOpen" :trigger="['click']" :disabled="readonly">
      <div
        class="flex flex-row justify-center items-center select-none rounded-md nc-base-icon-picker-trigger"
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
        <NcTooltip placement="topLeft" :disabled="readonly">
          <template #title> {{ $t('tooltip.changeIconColour') }} </template>

          <div>
            <GeneralProjectIcon :color="colorRef" :type="type" />
          </div>
        </NcTooltip>
      </div>

      <template #overlay>
        <div
          class="nc-base-icon-color-picker-dropdown relative bg-white rounded-lg border-1 border-gray-200 overflow-hidden max-w-[342px]"
        >
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
    </a-dropdown>
  </div>
</template>

<style lang="scss" scoped>
.nc-base-icon-color-picker-dropdown {
  box-shadow: 0px 8px 8px -4px #0000000a, 0px 20px 24px -4px #0000001a;
}
</style>
