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
      'h-8': size === 'small',
      'h-10': size === 'medium',
      'h-12': size === 'large',
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
    class="cursor-pointer relative"
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
        class="block h-full ml-1 w-1 rounded mr-2"
      ></div>
    </div>
    <div class="ml-3 mt-2 absolute">
      <span v-if="position === 'rightRounded' || position === 'none'"> .... </span>
      <span class="text-sm font-bold text-gray-800">{{ name }}</span>
      <span v-if="showDate" class="text-xs ml-1 text-gray-600">{{ date }}</span>
      <span v-if="position === 'leftRounded' || position === 'none'" class="absolute my-0 right-5"> .... </span>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
