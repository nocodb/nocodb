<script lang="ts" setup>
import type { NcModalProps } from './Modal.vue'

interface Props extends NcModalProps {
  type?: 'error' | 'success' | 'warning' | 'info'
  showIcon?: boolean
  title: string
  titleClass?: string

  content?: string
  contentClass?: string

  okText?: string
  okClass?: string

  cancelText?: string
  cancelClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  maskClosable: false,
  showSeparator: false,
  size: 'xs',
  height: 'auto',

  type: 'warning',
  showIcon: true,

  title: '',
  titleClass: '',

  content: '',
  contentClass: '',

  okText: '',
  okClass: '',

  cancelText: '',
  cancelClass: '',
})

const { visible: _visible, title, ...restProps } = props

const emits = defineEmits<Emits>()

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'cancel'): void
  (e: 'ok'): void
}

const vVisible = useVModel(props, 'visible', emits, { defaultValue: false })

const vModel = computed({
  get: () => vVisible.value,
  set: (value: boolean) => {
    vVisible.value = value

    emits('update:visible', value)

    if (!value) {
      emits('cancel')
    }
  },
})

const { type } = toRefs(props)

const iconName = computed<IconMapKey>(() => {
  if (type.value === 'success') {
    return 'circleCheckSolid'
  }

  if (type.value === 'error') {
    return 'ncAlertCircleFilled'
  }

  if (type.value === 'warning') {
    return 'alertTriangleSolid'
  }

  if (type.value === 'info') {
    return 'ncInfoSolid'
  }

  return 'alertTriangleSolid'
})

const onCancel = () => {
  vModel.value = false
  emits('update:visible', false)

  emits('cancel')
}
</script>

<template>
  <NcModal v-bind="restProps" v-model:visible="vModel">
    <div class="nc-modal-confirm flex flex-col gap-5" :class="[`nc-modal-confirm-type-${type}`]">
      <div class="flex gap-4">
        <div v-if="showIcon" class="nc-modal-confirm-icon-wrapper">
          <slot name="icon">
            <GeneralIcon :icon="iconName" class="nc-confirm-modal-icon" />
          </slot>
        </div>
        <div class="flex flex-col gap-1">
          <div class="nc-modal-confirm-title" :class="titleClass">
            <slot name="title">{{ title }}</slot>
          </div>
          <div v-if="content || $slots.content" class="nc-modal-confirm-content" :class="contentClass">
            <slot name="content">{{ content }}</slot>
          </div>
        </div>
      </div>

      <div class="flex flex-row w-full justify-end gap-4">
        <NcButton type="secondary" size="small" :class="cancelClass" @click="onCancel">
          {{ cancelText ?? $t('general.cancel') }}
        </NcButton>
        <NcButton type="primary" size="small" :class="okClass" @click="emits('ok')">
          {{ okText ?? $t('general.ok') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-modal-confirm {
  .nc-modal-confirm-icon-wrapper {
    @apply flex children:flex-none;

    .nc-confirm-modal-icon {
      @apply h-6 w-6;
    }
  }

  .nc-modal-confirm-title {
    @apply text-base text-nc-content-gray font-weight-700;
  }

  .nc-modal-confirm-content {
    @apply text-sm text-nc-content-gray-muted font-weight-500 line-clamp-3;
  }

  &.nc-modal-confirm-type-success {
    .nc-modal-confirm-icon-wrapper {
      @apply text-nc-content-green-dark;
    }
  }

  &.nc-modal-confirm-type-error {
    .nc-modal-confirm-icon-wrapper {
      @apply text-nc-content-red-dark;
    }
  }

  &.nc-modal-confirm-type-warning {
    .nc-modal-confirm-icon-wrapper {
      @apply text-nc-content-orange-medium;
    }
  }

  &.nc-modal-confirm-type-info {
    .nc-modal-confirm-icon-wrapper {
      @apply text-nc-content-brand;
    }
  }
}
</style>
