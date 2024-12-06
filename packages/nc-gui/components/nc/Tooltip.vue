<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import type { CSSProperties } from '@vue/runtime-dom'
import type { TooltipPlacement } from 'ant-design-vue/lib/tooltip'

interface Props {
  // Key to be pressed on hover to trigger the tooltip
  modifierKey?: string
  tooltipStyle?: CSSProperties
  attrs?: Record<string, unknown>
  // force disable tooltip
  color?: 'dark' | 'light'
  disabled?: boolean
  placement?: TooltipPlacement | undefined
  showOnTruncateOnly?: boolean
  hideOnClick?: boolean
  overlayClassName?: string
  wrapChild?: keyof HTMLElementTagNameMap
  mouseLeaveDelay?: number
  overlayInnerStyle?: object
}

const props = defineProps<Props>()

const modifierKey = computed(() => props.modifierKey)
const tooltipStyle = computed(() => props.tooltipStyle)
const disabled = computed(() => props.disabled)
const showOnTruncateOnly = computed(() => props.showOnTruncateOnly)
const hideOnClick = computed(() => props.hideOnClick)
const placement = computed(() => props.placement ?? 'top')
const wrapChild = computed(() => props.wrapChild ?? 'div')
const attributes = computed(() => props.attrs)

const color = computed(() => (props.color ? props.color : 'dark'))

const el = ref()

const element = ref()

const showTooltip = controlledRef(false, {
  onBeforeChange: (shouldShow) => {
    if (shouldShow && disabled.value) return false
  },
})

const isHovering = useElementHover(() => el.value)

const isOverlayHovering = useElementHover(() => element.value)

const allAttrs = useAttrs()

const isKeyPressed = ref(false)

const overlayClassName = computed(() => props.overlayClassName)

onKeyStroke(
  (e) => e.key === modifierKey.value,
  (e) => {
    e.preventDefault()

    if (isHovering.value) {
      showTooltip.value = true
    }

    isKeyPressed.value = true
  },
  { eventName: 'keydown' },
)

onKeyStroke(
  (e) => e.key === modifierKey.value,
  (e) => {
    e.preventDefault()

    showTooltip.value = false
    isKeyPressed.value = false
  },
  { eventName: 'keyup' },
)

watchDebounced(
  [isOverlayHovering, isHovering, () => modifierKey.value, () => disabled.value],
  ([overlayHovering, hovering, key, isDisabled]) => {
    if (showOnTruncateOnly?.value) {
      const targetElement = el?.value
      const isElementTruncated = targetElement && targetElement.scrollWidth > targetElement.clientWidth
      if (!isElementTruncated) {
        if (overlayHovering) {
          showTooltip.value = true
          return
        }
        showTooltip.value = false
        return
      }
    }
    if (overlayHovering) {
      showTooltip.value = true
      return
    }
    if ((!hovering || isDisabled) && !props.mouseLeaveDelay) {
      showTooltip.value = false
      return
    }

    // Show tooltip on mouseover if no modifier key is provided
    if (hovering && !key) {
      showTooltip.value = true
      return
    }

    // While hovering if the modifier key was changed and the key is not pressed, hide tooltip
    if (hovering && key && !isKeyPressed.value) {
      showTooltip.value = false
      return
    }

    // When mouse leaves the element, then re-enters the element while key stays pressed, show the tooltip
    if (!showTooltip.value && hovering && key && isKeyPressed.value) {
      showTooltip.value = true
    }
  },
  {
    debounce: 100,
  },
)

const divStyles = computed(() => ({
  style: allAttrs.style as CSSProperties,
  class: allAttrs.class as string,
}))

const onClick = () => {
  if (hideOnClick.value && showTooltip.value) {
    showTooltip.value = false
  }
}
</script>

<template>
  <a-tooltip
    v-model:visible="showTooltip"
    :overlay-class-name="`nc-tooltip-${color} ${showTooltip ? 'visible' : 'hidden'} ${overlayClassName}`"
    :overlay-style="tooltipStyle"
    :overlay-inner-style="overlayInnerStyle"
    arrow-point-at-center
    :trigger="[]"
    :placement="placement"
    :mouse-leave-delay="mouseLeaveDelay"
  >
    <template #title>
      <div ref="element">
        <slot name="title" />
      </div>
    </template>

    <component
      :is="wrapChild"
      ref="el"
      v-bind="{
        ...divStyles,
        ...attributes,
      }"
      @mousedown="onClick"
    >
      <slot />
    </component>
  </a-tooltip>
</template>

<style lang="scss">
.nc-tooltip.hidden {
  @apply invisible;
}
.nc-tooltip-dark {
  .ant-tooltip-inner {
    @apply !px-2 !py-1 !rounded-lg !bg-gray-800;
  }
  .ant-tooltip-arrow-content {
    @apply !bg-gray-800;
  }
}

.nc-tooltip-light {
  .ant-tooltip-inner {
    @apply !px-2 !py-1 !text-gray-800 !rounded-lg !bg-gray-200;
  }
  .ant-tooltip-arrow-content {
    @apply !bg-gray-200;
  }
}
</style>
