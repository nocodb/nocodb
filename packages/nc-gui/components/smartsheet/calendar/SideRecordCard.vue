<script setup lang="ts">

interface Props {
  name: string;
  date?: string;
  color?: string;
  showDate?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  name: '',
  date: '',
  color: 'blue',
  showDate: true,
});

</script>

<template>
  <div class="flex border-1 cursor-pointer border-gray-200 items-center px-2 py-3 rounded-lg">
    <span :class="{
      'bg-maroon-500': props.color === 'maroon',
      'bg-blue-500': props.color === 'blue',
      'bg-green-500': props.color === 'green',
      'bg-yellow-500': props.color === 'yellow',
      'bg-pink-500': props.color === 'pink',
      'bg-purple-500': props.color === 'purple',
    }" class="block h-10 w-1 rounded"></span>
    <div class="flex flex-col gap-1 ml-3">
      <span class="text-sm font-bold text-gray-700">{{name}}</span>
      <span v-if="showDate" class="text-xs text-gray-500">{{date}}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>