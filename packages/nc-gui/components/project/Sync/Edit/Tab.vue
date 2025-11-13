<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const modelValue = useVModel(props, 'modelValue')

const tabs = [
  {
    title: 'General',
    value: 'general',
  },
  {
    title: 'Sources',
    value: 'sources',
  },
]
</script>

<template>
  <div class="p-1 rounded-lg flex bg-nc-bg-gray-medium items-center">
    <div
      v-for="item in tabs"
      :key="item.value"
      :class="{
        'bg-nc-bg-default text-captionSmBold text-nc-content-gray-emphasis': modelValue === item.value,
        'text-nc-content-gray-subtle2 text-captionSm': modelValue !== item.value,
      }"
      class="px-2 py-1 cursor-pointer rounded-[6px]"
      @click="modelValue = item.value"
    >
      {{ item.title }}
    </div>
  </div>
</template>
