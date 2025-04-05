<script lang="ts" setup>
/**
 * NcAlert Component
 *
 * A customizable alert component built with Ant Design Vue.
 * It supports various alert types, optional icons, copy functionality, and automatic dismissal.
 */

import type { AlertProps } from 'ant-design-vue/es'
import { getI18n } from '~/plugins/a.i18n'

/**
 * NcAlert Component
 *
 * A customizable alert component with optional icons, descriptions, actions, and notifications.
 * Can be used as a standalone alert or inside the `message` notification system.
 */
export interface NcAlertProps extends Pick<AlertProps, 'type' | 'showIcon' | 'message' | 'description' | 'closable'> {
  /**
   * Controls the visibility of the alert.
   * @default true
   */
  visible?: boolean

  /**
   * Whether the alert has a border.
   * @default true
   */
  bordered?: boolean

  /**
   * Aligns the content vertically.
   * - `top`: Align to the top
   * - `center`: Align to the center
   * @default 'top'
   */
  align?: 'top' | 'center'

  /**
   * The text to be copied when clicking the copy button.
   */
  copyText?: any

  /**
   * Tooltip text for the copy button.
   * @default 'tooltip.copyErrorCode' (from i18n)
   */
  copyBtnTooltip?: string

  /**
   * Custom class for the message text.
   */
  messageClass?: string

  /**
   * Custom class for the description text.
   */
  descriptionClass?: string

  /**
   * Whether this alert is used inside a notification message.
   * @default false
   */
  isNotification?: boolean

  /**
   * Duration before the alert disappears (in seconds).
   * If not provided, uses default Ant Design message duration.
   */
  duration?: number

  /**
   * Whether to show a visual progress bar for the remaining duration.
   * @default true
   */
  showDuration?: boolean
}

const props = withDefaults(defineProps<NcAlertProps>(), {
  visible: true,
  showIcon: true,
  bordered: true,
  align: 'top',
  messageClass: '',
  descriptionClass: '',
  isNotification: false,
  showDuration: true,
})

/**
 * Emits events when the alert is closed or visibility changes.
 */
const emits = defineEmits<{
  /**
   * Event triggered when visibility is updated.
   * @param value - The new visibility state
   */
  (e: 'update:visible', value: boolean): void

  /**
   * Event triggered when the alert is closed.
   */
  (e: 'close'): void
}>()

const vVisible = useVModel(props, 'visible', emits, { defaultValue: true })

const { type } = toRefs(props)

const slots = useSlots()

const { t } = getI18n().global

const { copy } = useCopy()

const isMessageAvailable = computed(() => !!(slots.message || props.message))

const isDescriptionAvailable = computed(() => !!(slots.description || props.description))

const align = computed<NcAlertProps['align']>(() => {
  return isMessageAvailable.value && isDescriptionAvailable.value ? props.align : 'center'
})

/**
 * Tracks whether the text has been copied successfully.
 */
const isCopied = ref<boolean>(false)

const copyText = computed(() => props.copyText?.toString() ?? '')

const copyBtnTooltip = computed(() =>
  ncIsUndefined(props.copyBtnTooltip) && props.type === 'error' ? t('tooltip.copyErrorCode') : props.copyBtnTooltip,
)

let copiedTimeoutId: any

/**
 * Handles the copy button click event.
 * Copies the `copyText` value to the clipboard and shows a success indicator.
 */
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

/**
 * Computes the appropriate icon based on the alert type.
 */
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

/**
 * Handles alert close action.
 */
const handleClose = () => {
  vVisible.value = false
  emits('close')
}

/**
 * Remaining duration of the alert in seconds.
 */
const remDuration = ref(props.duration ?? ANT_MESSAGE_DURATION)

/**
 * Tracks the start time of the alert.
 */
const startTime = ref(performance.now())

/**
 * Computes the progress percentage based on remaining duration.
 */
const remDurationPercent = computed(() => (remDuration.value / (props.duration ?? ANT_MESSAGE_DURATION)) * 100)

let frameId: number

/**
 * Updates the progress bar smoothly using requestAnimationFrame.
 */
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
/**
 * Starts the progress bar animation when the component is mounted.
 */
onMounted(() => {
  if (!props.showDuration) return

  startTime.value = performance.now()
  updateProgress()
})

/**
 * Cancels the animation frame when the component is unmounted.
 */
onUnmounted(() => {
  cancelAnimationFrame(frameId)
})
</script>

<template>
  <div
    v-if="vVisible"
    class="nc-alert group"
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

      <div
        v-if="description || $slots.description"
        class="nc-alert-description"
        :class="[
          descriptionClass,
          {
            'nc-only-description': isDescriptionAvailable && !isMessageAvailable,
          },
        ]"
      >
        <slot name="description">{{ description }}</slot>
      </div>
    </div>

    <div v-if="$slots.action || copyText || closable" class="nc-alert-action">
      <slot name="action"> </slot>
      <NcTooltip
        v-if="copyText"
        :title="copyBtnTooltip"
        :disabled="!copyBtnTooltip"
        class="nc-alert-action-copy"
        :class="{
          'invisible group-hover:visible transition-all': isNotification,
        }"
      >
        <NcButton size="xsmall" type="text" @click.stop="onClickCopy">
          <div class="flex children:flex-none relative h-4 w-4">
            <Transition name="icon-fade" :duration="200">
              <GeneralIcon v-if="isCopied" icon="check" class="h-4 w-4 opacity-80" />
              <GeneralIcon v-else icon="copy" class="h-4 w-4 opacity-80" />
            </Transition>
          </div>
        </NcButton>
      </NcTooltip>
      <slot v-if="closable" name="closable" :handle-close="handleClose">
        <NcButton size="xsmall" type="text" @click.stop="handleClose">
          <GeneralIcon icon="close" class="text-nc-content-gray-subtle" />
        </NcButton>
      </slot>
    </div>

    <div
      v-if="isNotification && showDuration"
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
    @apply rounded-lg p-4 w-full border-1 border-nc-border-gray-medium;
  }

  &.nc-alert-notification {
    @apply min-w-[calc(100vw_-_64px)] md:min-w-[308px] max-w-[488px] w-[calc(30vw_-_32px)];
    .nc-alert-content {
      .nc-alert-description {
        @apply line-clamp-2;
      }
    }
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
      @apply text-sm font-weight-500 line-clamp-3;

      &:not(.nc-only-description) {
        @apply text-nc-content-gray-muted;
      }

      &.nc-only-description {
        @apply text-nc-content-gray;
      }
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
      @apply h-full  bg-brand-400;
    }
  }
}
</style>

<style lang="scss">
.ant-message {
  .ant-message-notice {
    &:has(.nc-alert-notification) {
      .ant-message-notice-content {
        @apply bg-white !rounded-lg p-4 gap-4 box-border border-1 border-nc-border-gray-medium text-left relative overflow-hidden;

        .ant-message-custom-content > span {
          @apply flex-none w-full block;
        }
      }
    }
  }
}
</style>
