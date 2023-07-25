<script lang="ts" setup>
const props = defineProps<{ checked: boolean; disabled?: boolean }>()

const emit = defineEmits(['change', 'update:checked'])

const checked = useVModel(props, 'checked', emit)

const onChange = (e: boolean) => {
  emit('change', e)
}
</script>

<template>
  <a-switch v-model:checked="checked" :disabled="props.disabled" class="nc-switch !min-w-9 !w-9 !h-4.75" @change="onChange">
    <slot />
  </a-switch>
</template>

<style lang="scss">
.nc-switch {
  .ant-switch-handle {
    @apply !h-3.75 !min-w-4.5 !w-4.5;
  }
}
</style>
