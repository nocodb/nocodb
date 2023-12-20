<script setup lang="ts">

interface Props {
  name: string;
  date?: string;
  color?: string;
  size? : 'small' | 'medium' | 'large';
  showDate?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  name: '',
  date: '',
  color: 'blue',
  size: 'small',
  showDate: true,
});

</script>

<template>
  <div :class="{
    'bg-maroon-50': props.color === 'maroon',
      'bg-blue-50': props.color === 'blue',
      'bg-green-50': props.color === 'green',
      'bg-yellow-50': props.color === 'yellow',
      'bg-pink-50': props.color === 'pink',
      'bg-purple-50': props.color === 'purple',
      'h-12': props.size === 'medium',
      'h-16': props.size === 'large',
      'h-8': props.size === 'small',
  }" class="flex items-center w-full border-1 cursor-pointer border-gray-200 gap-2 items-center px-2 py-3 rounded-lg">
    <span :class="{
      'bg-maroon-500': props.color === 'maroon',
      'bg-blue-500': props.color === 'blue',
      'bg-green-500': props.color === 'green',
      'bg-yellow-500': props.color === 'yellow',
      'bg-pink-500': props.color === 'pink',
      'bg-purple-500': props.color === 'purple',
    }" class="block h-5 w-1 rounded"></span>
    <div class="flex flex-row items-baseline gap-2">
      <span class="text-sm font-bold text-gray-800">{{name}}</span>
      <span v-if="showDate" class="text-xs text-gray-600">{{date}}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>