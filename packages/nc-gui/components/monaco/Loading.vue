<template>
  <div :class="[height, 'w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900']">
    <div class="text-center">
      <a-spin size="large" />
      <div class="mt-4 text-gray-600 dark:text-gray-400">
        Loading Monaco Editor...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  height?: string
}

withDefaults(defineProps<Props>(), {
  height: 'h-full'
})
</script>
