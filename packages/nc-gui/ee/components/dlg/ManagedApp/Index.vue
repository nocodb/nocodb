<script lang="ts" setup>
interface Props {
  visible: boolean
  modalSize: 'small' | 'medium' | 'large' | keyof typeof modalSizes
  title?: string
  subTitle?: string
  variant?: 'draftOrPublish' | 'versionHistory'
  contentClass?: string
  maskClosable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modalSize: 'sm',
  contentClass: '',
  maskClosable: true,
})

const emits = defineEmits(['update:visible'])

const vVisible = useVModel(props, 'visible', emits)

const { modalSize, variant } = toRefs(props)
</script>

<template>
  <NcModal
    v-model:visible="vVisible"
    :size="modalSize"
    :height="modalSize === 'sm' ? 'auto' : undefined"
    :mask-closable="maskClosable"
    nc-modal-class-name="nc-modal-dlg-managed-app"
  >
    <slot v-if="$slots.default"> </slot>
    <template v-else-if="variant === 'draftOrPublish'">
      <DlgManagedAppDraftOrPublish v-model:visible="vVisible" />
    </template>
    <template v-else-if="variant === 'versionHistory'">
      <DlgManagedAppVersionHistory v-model:visible="vVisible" />
    </template>
    <template v-else>
      <slot name="header">
        <DlgManagedAppHeader v-model:visible="vVisible" :modal-size="modalSize" :title="title" :sub-title="subTitle" />
      </slot>

      <div class="flex-1 nc-scrollbar-thin" :class="contentClass">
        <slot name="content"> </slot>
      </div>

      <slot v-if="$slots.footer" name="footer"> </slot>
    </template>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-dlg-managed-app {
  @apply !p-0;

  &.nc-modal-size-sm {
    max-height: min(90vh, 560px) !important;
    height: min(90vh, 560px) !important;
  }
}
</style>
