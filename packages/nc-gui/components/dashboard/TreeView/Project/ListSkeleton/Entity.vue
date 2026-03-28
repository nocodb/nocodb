<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    rows?: number
    containerClass?: string
  }>(),
  {
    rows: 10,
    containerClass: '',
  },
)
</script>

<template>
  <div class="nc-project-home-section">
    <div class="flex flex-col gap-3" :class="containerClass">
      <div v-for="i in props.rows" :key="i" class="flex items-center gap-2">
        <a-skeleton-avatar active shape="square" class="!h-5 !w-5 !children:(rounded-md w-5 h-5)" />
        <a-skeleton-input active size="small" class="children:rounded-md h-5" :style="{ width: `${50 + (i % 3) * 20}%` }" />
      </div>
    </div>
  </div>
</template>
