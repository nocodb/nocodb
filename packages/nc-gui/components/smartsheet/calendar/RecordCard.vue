<script lang="ts" setup>
import type { Row } from '~/lib'

interface Props {
  color?: string
  resize?: boolean
  hover?: boolean
  record?: Row
  selected?: boolean
  size?: 'small' | 'medium' | 'large' | 'auto'
  position?: 'leftRounded' | 'rightRounded' | 'rounded' | 'none'
}

withDefaults(defineProps<Props>(), {
  resize: true,
  selected: false,
  hover: false,
  color: 'blue',
  size: 'small',
  position: 'rounded',
})

const emit = defineEmits(['resize-start'])
</script>

<template>
  <div
    :class="{
      'min-h-9': size === 'small',
      'min-h-10': size === 'medium',
      'min-h-12': size === 'large',
      'h-full': size === 'auto',
      'rounded-l-lg ml-1': position === 'leftRounded',
      'rounded-r-lg mr-1': position === 'rightRounded',
      'rounded-lg mx-1': position === 'rounded',
      'rounded-none': position === 'none',
      'bg-maroon-50': color === 'maroon',
      'bg-blue-50': color === 'blue',
      'bg-green-50': color === 'green',
      'bg-yellow-50': color === 'yellow',
      'bg-pink-50': color === 'pink',
      'bg-purple-50': color === 'purple',
      'group-hover:(border-brand-500 border-2)': resize,
      '!border-brand-500 border-2': selected || hover,
    }"
    class="relative group border-2 border-white"
  >
    <div class="h-full absolute py-2">
      <div
        v-if="position === 'leftRounded' || position === 'rounded'"
        :class="{
          'bg-maroon-500': color === 'maroon',
          'bg-blue-500': color === 'blue',
          'bg-green-500': color === 'green',
          'bg-yellow-500': color === 'yellow',
          'bg-pink-500': color === 'pink',
          'bg-purple-500': color === 'purple',
        }"
        class="block h-full min-h-5 ml-1 w-1 rounded mr-2"
      ></div>
    </div>

    <div
      v-if="(position === 'leftRounded' || position === 'rounded') && resize"
      :class="{
        '!block !border-2 !rounded-lg !border-brand-500': selected || hover,
      }"
      class="absolute mt-0.6 h-7.1 hidden -left-4 resize"
    >
      <NcButton size="xsmall" type="secondary" @mousedown.stop="emit('resize-start', 'left', $event, record)">
        <component :is="iconMap.drag" class="text-gray-400"></component>
      </NcButton>
    </div>

    <div class="ml-3 pr-3 text-ellipsis overflow-hidden w-full h-8 absolute">
      <span v-if="position === 'rightRounded' || position === 'none'"> .... </span>
      <span class="absolute ml-1 text-sm text-gray-800">
        <slot />
      </span>
      <span v-if="position === 'leftRounded' || position === 'none'" class="absolute my-0 right-5"> .... </span>
    </div>

    <div
      v-if="(position === 'rightRounded' || position === 'rounded') && resize"
      :class="{
        '!block border-2 rounded-lg border-brand-500': selected || hover,
      }"
      class="absolute mt-0.6 hidden h-7.1 -right-4 border-1 resize !group-hover:(border-brand-500 border-2 block rounded-lg)"
    >
      <NcButton size="xsmall" type="secondary" @mousedown.stop="emit('resize-start', 'right', $event, record)">
        <component :is="iconMap.drag" class="text-gray-400"></component>
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.resize {
  cursor: ew-resize;
}
</style>
