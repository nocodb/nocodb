<script lang="ts" setup>
interface Props {
  title?: string
  subtitle?: string
}

defineProps<Props>()
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="text-base text-nc-content-gray font-weight-700">
      <slot name="title">{{ title }}</slot>
    </div>
    <div class="flex-1 text-sm text-nc-content-gray-subtle font-weight-500">
      <slot name="subTitle">{{ subtitle }}</slot>
    </div>
    <div>
      <slot name="action"></slot>
    </div>
  </div>
</template>
