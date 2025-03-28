<script lang="ts" setup>
import type { AlertProps } from 'ant-design-vue/es'
import { getI18n } from '~/plugins/a.i18n'

interface Props extends Pick<AlertProps, 'type' | 'showIcon' | 'message' | 'description' | 'closable'> {
  visible?: boolean
  bordered?: boolean
  align?: 'top' | 'center'
  copyText?: any
  copyBtnTooltip?: string
  messageClass?: string
  descriptionClass?: string
  isNotification?: boolean
  duration?: number
  showDuration?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
  showIcon: true,
  bordered: true,
  align: 'top',
  messageClass: '',
  descriptionClass: '',
  isNotification: false,
  showDuration: true,
})

const emits = defineEmits<Emits>()

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}

const vVisible = useVModel(props, 'visible', emits, { defaultValue: true })

const { type } = toRefs(props)

const { t } = getI18n().global

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
const remDuration = ref(props.duration ?? ANT_MESSAGE_DURATION)
const startTime = ref(performance.now())

const remDurationPercent = computed(() => (remDuration.value / (props.duration ?? ANT_MESSAGE_DURATION)) * 100)

let frameId: number

const updateProgress = () => {
  const elapsedTime = (performance.now() - startTime.value) / 1000 // Convert ms to seconds
  const totalDuration = props.duration ?? ANT_MESSAGE_DURATION
  const remaining = Math.max(totalDuration - elapsedTime, 0)

  // Lerp (smooth transition instead of abrupt frame jumps)
  remDuration.value = remDuration.value * 0.9 + remaining * 0.1

  if (remDuration.value > 0.01) {
    // Stop when close to zero
    frameId = requestAnimationFrame(updateProgress)
  } else {
    remDuration.value = 0 // Ensure it reaches zero exactly
  }
}

onMounted(() => {
  if (!props.showDuration) return

  startTime.value = performance.now()
  updateProgress()
})

onUnmounted(() => {
  cancelAnimationFrame(frameId)
})
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
        'no-border': !bordered,
        'nc-alert-notification': isNotification,
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

    <div
      class="nc-alert-progress-wrapper"
      :class="{
        'bg-nc-bg-brand': remDurationPercent > 0,
        'bg-nc-bg-gray-medium': remDurationPercent <= 0,
      }"
    >
      <div
        class="nc-alert-progress"
        :style="{
          width: `${remDurationPercent}%`,
        }"
      ></div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-alert {
  @apply flex gap-4;

  &:not(.nc-alert-notification) {
    @apply rounded-lg p-4  w-full border-1 border-nc-border-gray-medium;
  }

  &.nc-alert-notification {
    @apply min-w-[340px];
  }

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

  &.nc-alert-type-success,
  &.nc-alert-type-undefined {
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

  .nc-alert-progress-wrapper {
    @apply absolute bottom-0 left-0 right-0 h-1;

    .nc-alert-progress {
      @apply h-full transition-all duration-200 bg-brand-400;
    }
  }
}
</style>

<style lang="scss">
.ant-message-notice-content {
  &:has(.ant-message-custom-content .nc-alert-notification) {
    @apply bg-white rounded-lg p-4 gap-4 box-border border-1 border-nc-border-gray-medium text-left relative overflow-hidden;
  }
}
</style>
