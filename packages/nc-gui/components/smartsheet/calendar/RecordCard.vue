<script lang="ts" setup>
interface Props {
  name: string
  date?: string
  color?: string
  size?: 'small' | 'medium' | 'large'
  showDate?: boolean
  position?: 'leftRounded' | 'rightRounded' | 'rounded' | 'none'
}

const props = withDefaults(defineProps<Props>(), {
  name: '',
  date: '',
  color: 'blue',
  size: 'small',
  showDate: true,
  position: 'rounded',
})
</script>

<template>
  <div
    :class="{
      'h-12': props.size === 'medium',
      'h-16': props.size === 'large',
      'h-8': props.size === 'small',
      'pr-2': props.position === 'leftRounded',
      'pl-2': props.position === 'rightRounded',
      'px-2': props.position === 'rounded',
    }"
    class="w-full gap-2"
  >
    <div
      :class="{
        'bg-maroon-50': props.color === 'maroon',
        'bg-blue-50': props.color === 'blue',
        'bg-green-50': props.color === 'green',
        'bg-yellow-50': props.color === 'yellow',
        'bg-pink-50': props.color === 'pink',
        'bg-purple-50': props.color === 'purple',
        'rounded-l-lg': props.position === 'leftRounded',
        'rounded-r-lg': props.position === 'rightRounded',
        'rounded-lg': props.position === 'rounded',
        'rounded-none': props.position === 'none',
      }"
      class="flex items-center border-1 px-2 cursor-pointer border-gray-200 py-2"
    >
      <span
        :class="{
          'bg-maroon-500': props.color === 'maroon',
          'bg-blue-500': props.color === 'blue',
          'bg-green-500': props.color === 'green',
          'bg-yellow-500': props.color === 'yellow',
          'bg-pink-500': props.color === 'pink',
          'bg-purple-500': props.color === 'purple',
        }"
        class="block h-5 w-1 rounded mr-2"
      ></span>
      <div class="flex flex-row items-baseline gap-2">
        <span class="text-sm font-bold text-gray-800">{{ name }}</span>
        <span v-if="showDate" class="text-xs text-gray-600">{{ date }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
