<script lang="ts" setup>
interface Props {
  name: string
  fromDate?: string
  toDate?: string
  color?: string
  showDate?: boolean
  invalid?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  name: '',
  fromDate: '',
  color: 'blue',
  showDate: true,
  invalid: false,
})
</script>

<template>
  <div class="border-1 cursor-pointer border-gray-200 items-center px-2 py-3 rounded-lg">
    <div class="flex items-center">
      <span
        :class="{
          'bg-maroon-500': props.color === 'maroon',
          'bg-blue-500': props.color === 'blue',
          'bg-green-500': props.color === 'green',
          'bg-yellow-500': props.color === 'yellow',
          'bg-pink-500': props.color === 'pink',
          'bg-purple-500': props.color === 'purple',
        }"
        class="block h-10 w-1 rounded"
      ></span>
      <div class="flex flex-col gap-1 ml-3">
        <span class="text-sm max-w-36 truncate text-gray-800">{{ name }}</span>
        <span v-if="showDate" class="text-xs text-gray-500">{{ fromDate }} {{ toDate ? ` - ${toDate}` : '' }}</span>
      </div>
    </div>

    <div v-if="invalid" class="gap-3 bg-yellow-50 mt-2 border-gray-200 border-1 rounded-lg p-2 flex">
      <component :is="iconMap.warning" class="text-yellow-500 h-4 w-4" />
      <div class="flex flex-col gap-1">
        <h1 class="text-gray-800 text-bold">Date mismatch</h1>
        <p class="text-gray-500">Selected End date is before Start date.</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
