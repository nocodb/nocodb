<script lang="ts" setup>
import type { NcButtonProps } from './Button.vue'
import type { NcModalProps } from './Modal.vue'

/**
 * NcModalConfirm component - A customizable modal confirmation dialog.
 *
 * @example
 * ```ts
 * const isOpen = ref(true)
 *
 * const { close } = useDialog(NcModalConfirm, {
 *   'visible': isOpen,
 *   'title': 'Confirm Action',
 *   'content': 'Are you sure you want to proceed?',
 *   'okText': 'Yes',
 *   'cancelText': 'No',
 *   'onCancel': closeDialog,
 *   'onOk': async () => {
 *     closeDialog()
 *     await performAction()
 *   },
 *   'update:visible': closeDialog,
 * })
 *
 * function closeDialog() {
 *   isOpen.value = false
 *   close(1000)
 * }
 * ```
 */

/**
 * Props interface extending NcModalProps with additional customization options.
 */
export interface NcConfirmModalProps extends NcModalProps {
  /** Type of modal (affects icon and styling) */
  type?: 'error' | 'success' | 'warning' | 'info'

  /** Whether to show an icon next to the title */
  showIcon?: boolean

  /** Title of the modal */
  title: string

  /** Additional class for title styling */
  titleClass?: string

  /** Content of the modal */
  content?: string

  /** Additional class for content styling */
  contentClass?: string

  /** Text for the OK button */
  okText?: string

  /** Additional class for the OK button */
  okClass?: string

  okProps?: Partial<NcButtonProps>

  /** Text for the Cancel button */
  cancelText?: string

  /** Additional class for the Cancel button */
  cancelClass?: string

  cancelProps?: Partial<NcButtonProps>

  /** Determines which button gets focus on open */
  focusBtn?: 'ok' | 'cancel' | null
}

const props = withDefaults(defineProps<NcConfirmModalProps>(), {
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
  focusBtn: 'ok',
})

const emits = defineEmits<Emits>()

const { visible: _visible, title, ...restProps } = props

interface Emits {
  (e: 'update:visible', value: boolean): void
  // cancel is generic, on click cancel or close modal using keybord shortcut or overlay click
  (e: 'cancel'): void
  (e: 'clickCancel'): void
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

const cancelBtnRef = ref<HTMLButtonElement>()

const okBtnRef = ref<HTMLButtonElement>()

const onClickCancel = () => {
  vModel.value = false
  emits('clickCancel')
}

/** Watches for cancel button reference and sets focus if applicable */
watch(cancelBtnRef, () => {
  if (!cancelBtnRef.value?.$el || props.focusBtn !== 'cancel') return
  ;(cancelBtnRef.value?.$el as HTMLButtonElement)?.focus()
})

/** Watches for OK button reference and sets focus if applicable */
watch(okBtnRef, () => {
  if (!okBtnRef.value?.$el || props.focusBtn !== 'ok') return
  ;(okBtnRef.value?.$el as HTMLButtonElement)?.focus()
})
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
        <div class="flex flex-col gap-2">
          <div class="nc-modal-confirm-title" :class="titleClass">
            <slot name="title">{{ title }}</slot>
          </div>
          <div v-if="content || $slots.content" class="nc-modal-confirm-content" :class="contentClass">
            <slot name="content">{{ content }}</slot>
          </div>
        </div>
      </div>

      <div class="flex flex-row w-full justify-end gap-4">
        <NcButton
          v-bind="cancelProps"
          ref="cancelBtnRef"
          :type="cancelProps?.type ?? 'secondary'"
          size="small"
          :class="cancelClass"
          @click="onClickCancel"
        >
          {{ cancelText || $t('general.cancel') }}
        </NcButton>
        <NcButton
          v-bind="okProps"
          ref="okBtnRef"
          :type="okProps?.type ?? 'primary'"
          size="small"
          :class="okClass"
          @click="emits('ok')"
        >
          {{ okText || $t('general.ok') }}
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
    @apply text-sm text-nc-content-gray-subtle2 font-weight-500 line-clamp-3;
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
