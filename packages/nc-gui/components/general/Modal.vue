<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :class="{ active: visible }"
    width="max(30vw, 600px)"
    centered
    :closable="false"
    wrap-class-name="nc-modal"
    :footer="null"
    @keydown.esc="visible = false"
  >
    <slot />
  </a-modal>
</template>

<style lang="scss">
.nc-modal {
  .ant-modal-content {
    @apply !p-0;
  }
}
</style>
