<script lang="ts" setup>
interface Props {
  record: Record<string, string>
  color?: string
  resize?: boolean
  selected?: boolean
  hover?: boolean
  position?: 'topRounded' | 'bottomRounded' | 'rounded' | 'none'
}

withDefaults(defineProps<Props>(), {
  resize: true,
  selected: false,
  hover: false,
  color: 'blue',
  position: 'rounded',
})

const emit = defineEmits(['resize-start'])
</script>

<template>
  <div
    v-if="(position === 'topRounded' || position === 'rounded') && resize"
    class="absolute flex items-center justify-center w-full -mt-4 h-7.1 hidden z-1 resize !group-hover:(flex rounded-lg)"
  >
    <NcButton
      :class="{
        '!flex rounded-md border-brand-500': selected || hover,
      }"
      class="!group-hover:(border-brand-500) !border-1 text-gray-400 cursor-ns-resize"
      size="xsmall"
      type="secondary"
      @mousedown.stop="emit('resize-start', 'left', $event, record)"
    >
      <component :is="iconMap.drag" class="mt-0.5" />
    </NcButton>
  </div>
  <div
    :class="{
      'rounded-t-md': position === 'topRounded',
      'rounded-b-md': position === 'bottomRounded',
      'rounded-md': position === 'rounded',
      'rounded-none': position === 'none',
      'bg-maroon-50': color === 'maroon',
      'bg-blue-50': color === 'blue',
      'bg-green-50': color === 'green',
      'bg-yellow-50': color === 'yellow',
      'bg-pink-50': color === 'pink',
      'bg-purple-50': color === 'purple',
      'group-hover:(border-brand-500)': resize,
      '!border-blue-200 border-1': selected,
      'shadow-md': hover,
    }"
    class="relative flex gap-2 items-center !pr-1 h-full ml-0.25 border-1 border-transparent"
  >
    <div class="h-full py-1">
      <div
        :class="{
          'bg-maroon-500': color === 'maroon',
          'bg-blue-500': color === 'blue',
          'bg-green-500': color === 'green',
          'bg-yellow-500': color === 'yellow',
          'bg-pink-500': color === 'pink',
          'bg-purple-500': color === 'purple',
        }"
        class="block h-full min-h-9 ml-1 w-1 rounded"
      ></div>
    </div>

    <div v-if="position === 'bottomRounded' || position === 'none'" class="ml-3">....</div>

    <div
      class="flex overflow-x-hidden break-word whitespace-nowrap overflow-hidden text-ellipsis w-full truncate text-ellipsis flex-col gap-1"
    >
      <NcTooltip :disabled="selected" class="inline-block" show-on-truncate-only wrap-child="span">
        <slot class="pl-1 pr-2 text-sm text-nowrap text-gray-800 leading-7" />
        <template #title>
          <slot />
        </template>
      </NcTooltip>
      <slot name="time" />
    </div>

    <div v-if="position === 'topRounded' || position === 'none'" class="h-full pb-7 flex items-end ml-3">....</div>
  </div>
  <div
    v-if="(position === 'bottomRounded' || position === 'rounded') && resize"
    class="absolute items-center justify-center w-full hidden h-7.1 -mt-4 !group-hover:(flex rounded-lg)"
  >
    <NcButton
      :class="{
        '!flex border-1 rounded-lg z-1 cursor-ns-resize	border-brand-500': selected || hover,
      }"
      class="!group-hover:(border-brand-500) text-gray-400 !border-1"
      size="xsmall"
      type="secondary"
      @mousedown.stop="emit('resize-start', 'right', $event, record)"
    >
      <component :is="iconMap.drag" class="mt-0.5" />
    </NcButton>
  </div>
</template>

<style lang="scss" scoped></style>
