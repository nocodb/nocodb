<script lang="ts" setup>
import type { AlertProps } from 'ant-design-vue/es'

interface Props extends Pick<AlertProps, 'type' | 'showIcon' | 'message' | 'description' | 'closable'> {
  visible?: boolean
  bordered?: boolean
  align?: 'top' | 'center'
  copyText?: any
  copyBtnTooltip?: string
  messageClass?: string
  descriptionClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
  bordered: true,
  align: 'top',
  messageClass: '',
  descriptionClass: '',
})

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}

const emits = defineEmits<Emits>()

const vVisible = useVModel(props, 'visible', emits, { defaultValue: true })

const { type } = toRefs(props)

const { t } = useI18n()

const { copy } = useCopy()

const isCopied = ref<boolean>(false)

const copyText = computed(() => props.copyText?.toString() ?? '')

const copyBtnTooltip = computed(() => (ncIsUndefined(props.copyBtnTooltip) ? t('tooltip.copyErrorCode') : props.copyBtnTooltip))

let copiedTimeoutId: any

const onClickCopy = async () => {
  if (copiedTimeoutId) {
    clearTimeout(copiedTimeoutId)
  }

  if (!copyText.value) return

  try {
    await copy(copyText.value)

    isCopied.value = true

    copiedTimeoutId = setTimeout(() => {
      isCopied.value = false
      clearTimeout(copiedTimeoutId)
    }, 3000)
  } catch (e: any) {
    message.error(e.message)
  }
}

const iconName = computed<IconMapKey>(() => {
  if (type.value === 'error') {
    return 'ncAlertCircleFilled'
  }

  if (type.value === 'warning') {
    return 'alertTriangleSolid'
  }

  if (type.value === 'info') {
    return 'ncInfoSolid'
  }

  return 'circleCheckSolid'
})

const handleClose = () => {
  vVisible.value = false
  emits('close')
}
</script>

<template>
  <div
    v-if="vVisible"
    class="nc-alert"
    :class="[
      `nc-alert-type-${type}`,
      {
        'items-center': align === 'center',
        'items-start': align === 'top',
      },
    ]"
  >
    <div v-if="showIcon" class="nc-alert-icon-wrapper">
      <slot name="icon">
        <GeneralIcon :icon="iconName" class="nc-alert-icon" />
      </slot>
    </div>

    <div class="nc-alert-content flex-1">
      <div v-if="message || $slots.message" class="nc-alert-message" :class="messageClass">
        <slot name="message">{{ message }}</slot>
      </div>

      <div v-if="description || $slots.description" class="nc-alert-description" :class="descriptionClass">
        <slot name="description">{{ description }}</slot>
      </div>
    </div>

    <div v-if="$slots.action || copyText || closable" class="nc-alert-action">
      <slot name="action"> </slot>
      <NcTooltip v-if="copyText" :title="copyBtnTooltip" :disabled="!copyBtnTooltip">
        <NcButton size="xsmall" type="text" @click.stop="onClickCopy">
          <div class="flex children:flex-none relative h-4 w-4">
            <Transition name="icon-fade" :duration="200">
              <GeneralIcon v-if="isCopied" icon="check" class="h-4 w-4 opacity-80" />
              <GeneralIcon v-else icon="copy" class="h-4 w-4 opacity-80" />
            </Transition>
          </div>
        </NcButton>
      </NcTooltip>
      <NcButton v-if="closable" size="xsmall" type="text" @click.stop="handleClose">
        <GeneralIcon icon="close" class="text-nc-content-gray-subtle" />
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-alert {
  @apply rounded-lg p-4 flex gap-4 w-full border-1 border-nc-border-gray-medium;

  &.no-border {
    @apply border-none;
  }

  .nc-alert-icon-wrapper {
    @apply flex children:flex-none;

    .nc-alert-icon {
      @apply h-6 w-6;
    }
  }

  .nc-alert-content {
    @apply flex flex-col gap-1;

    .nc-alert-message {
      @apply text-base text-nc-content-gray font-weight-700;
    }

    .nc-alert-description {
      @apply text-sm text-nc-content-gray-muted font-weight-500 line-clamp-3;
    }
  }

  .nc-alert-action {
    @apply flex items-center gap-3 children:flex-none;
  }

  &.nc-alert-type-success {
    .nc-alert-icon-wrapper {
      @apply text-nc-content-green-dark;
    }
  }

  &.nc-alert-type-error {
    .nc-alert-icon-wrapper {
      @apply text-nc-content-red-dark;
    }
  }

  &.nc-alert-type-warning {
    .nc-alert-icon-wrapper {
      @apply text-nc-content-orange-medium;
    }
  }

  &.nc-alert-type-info {
    .nc-alert-icon-wrapper {
      @apply text-nc-content-brand;
    }
  }
}
</style>
