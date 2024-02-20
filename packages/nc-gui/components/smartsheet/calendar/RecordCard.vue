<script lang="ts" setup>
interface Props {
  record: Record<string, string>
  name: string
  date?: string
  color?: string
  resize?: boolean
  size?: 'small' | 'medium' | 'large'
  showDate?: boolean
  position?: 'leftRounded' | 'rightRounded' | 'rounded' | 'none'
}

withDefaults(defineProps<Props>(), {
  name: '',
  date: '',
  resize: true,
  color: 'blue',
  size: 'small',
  showDate: true,
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
      'rounded-l-lg ml-3': position === 'leftRounded',
      'rounded-r-lg mr-3': position === 'rightRounded',
      'rounded-lg mx-3': position === 'rounded',
      'rounded-none': position === 'none',
      'bg-maroon-50': color === 'maroon',
      'bg-blue-50': color === 'blue',
      'bg-green-50': color === 'green',
      'bg-yellow-50': color === 'yellow',
      'bg-pink-50': color === 'pink',
      'bg-purple-50': color === 'purple',
      'group-hover:(border-brand-500 border-2)': resize,
    }"
    class="relative group"
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
      v-if="position === 'leftRounded' || (position === 'rounded' && resize)"
      :class="{
        '!group-hover:(border-brand-500 block border-2 rounded-lg)': resize,
      }"
      class="absolute mt-0.6 h-7.1 hidden -left-3 resize"
    >
      <NcButton size="xsmall" type="secondary" @mousedown.stop="emit('resize-start', 'left', $event, record)">
        <component :is="iconMap.drag" class="text-gray-400"></component>
      </NcButton>
    </div>

    <div class="ml-3 mt-2 text-ellipsis overflow-hidden w-full h-6 absolute">
      <span v-if="position === 'rightRounded' || position === 'none'"> .... </span>
      <span class="text-sm text-gray-800">{{ name }}</span>
      <span v-if="showDate" class="text-xs ml-1 text-gray-600">{{ date }}</span>
      <span v-if="position === 'leftRounded' || position === 'none'" class="absolute my-0 right-5"> .... </span>
    </div>
    <div
      v-if="position === 'rightRounded' || (position === 'rounded' && resize)"
      :class="{
        '!group-hover:(border-brand-500 border-2 block rounded-lg)': resize,
      }"
      class="absolute mt-0.6 hidden h-7.1 -right-3 border-1 resize"
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
