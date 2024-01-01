<script lang="ts" setup>
interface Props {
  name: string
  date?: string
  color?: string
  size?: 'small' | 'medium' | 'large'
  showDate?: boolean
  position?: 'leftRounded' | 'rightRounded' | 'rounded' | 'none'
}

withDefaults(defineProps<Props>(), {
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
      'min-h-12': size === 'medium',
      'min-h-16': size === 'large',
      'min-h-10': size === 'small',
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
    }"
    class="gap-2 border-gray-200 border-1"
  >
    <div class="flex items-center relative px-2 cursor-pointer py-2">
      <span
        v-if="position === 'leftRounded' || position === 'rounded'"
        :class="{
          'bg-maroon-500': color === 'maroon',
          'bg-blue-500': color === 'blue',
          'bg-green-500': color === 'green',
          'bg-yellow-500': color === 'yellow',
          'bg-pink-500': color === 'pink',
          'bg-purple-500': color === 'purple',
        }"
        class="block h-5 w-1 rounded mr-2"
      ></span>
      <div class="flex flex-row items-baseline gap-2">
        <span v-if="position === 'rightRounded' || position === 'none'"> .... </span>

        <span class="text-sm font-bold text-gray-800">{{ name }}</span>
        <span v-if="showDate" class="text-xs text-gray-600">{{ date }}</span>
      </div>
      <span v-if="position === 'leftRounded' || position === 'none'" class="absolute my-0 right-5"> .... </span>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
