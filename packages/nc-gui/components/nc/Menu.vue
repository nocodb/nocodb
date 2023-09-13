<script lang="ts" setup>
const props = defineProps<{
  selectable?: boolean | undefined
}>()

const selectable = computed(() => props.selectable ?? false)
</script>

<template>
  <a-menu class="nc-menu" :selectable="selectable">
    <slot />
  </a-menu>
</template>

<style lang="scss">
.nc-menu {
  @apply bg-white !rounded-md !py-1;
}
</style>
