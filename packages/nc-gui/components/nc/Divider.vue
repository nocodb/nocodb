<script lang="ts" setup>
const props = defineProps<{
  dividerClass?: string
}>()

const dividerClass = toRef(props, 'dividerClass')
</script>

<template>
  <a-divider :class="dividerClass" class="nc-divider" />
</template>

<style lang="scss">
.nc-divider.ant-divider {
  @apply my-1.25;
}
</style>
