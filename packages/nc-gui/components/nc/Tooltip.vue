<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import type { CSSProperties } from '@vue/runtime-dom'
import type { TooltipPlacement } from 'ant-design-vue/lib/tooltip'

/**
 * NcTooltip Component
 *
 * A customizable tooltip component with optional modifiers, styles, and placement.
 *
 * @example
 * ### Single line `truncate`
 *
 * ```vue
 *  <NcTooltip
 *    :title="text"
 *    show-on-truncate-only
 *    class="truncate"
 *  >
 *    {{ text }}
 *  </NcTooltip>
 * ```
 *
 * ## Multi-line `line-clamp`
 * ```vue
 *  <NcTooltip
 *    :title="text"
 *    show-on-truncate-only
 *    :line-clamp="2"
 *    class="line-clamp-2"
 *  >
 *    {{ text }}
 *  </NcTooltip>
 * ```
 */
interface NcTooltipProps {
  /**
   * Key to be pressed on hover to trigger the tooltip
   */
  modifierKey?: string
  tooltipStyle?: CSSProperties
  attrs?: Record<string, unknown>
  color?: 'dark' | 'light'
  // force disable tooltip
  disabled?: boolean
  placement?: TooltipPlacement | undefined
  showOnTruncateOnly?: boolean
  hideOnClick?: boolean
  overlayClassName?: string
  wrapChild?: keyof HTMLElementTagNameMap
  mouseLeaveDelay?: number
  overlayInnerStyle?: object
  /**
   * Whether to show the arrow or not
   */
  arrow?: boolean
  /**
   * **Note:**
   * Under the hood, we use the `Range#getBoundingClientRect()` technique to check if the text is truncated.
   * This technique works best when text is not deeply nested.
   * This method has performance overhead — avoid using it on large lists.
   */
  lineClamp?: number
}

const props = withDefaults(defineProps<NcTooltipProps>(), {
  arrow: true,
  placement: 'top',
  wrapChild: 'div',
  color: 'dark',
})

const {
  modifierKey,
  tooltipStyle,
  disabled,
  showOnTruncateOnly,
  hideOnClick,
  placement,
  wrapChild,
  attrs: attributes,
  color,
} = toRefs(props)

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

      let isElementTruncated = false

      if (props.lineClamp) {
        // Multi-line `line-clamp`
        isElementTruncated = targetElement && isLineClamped(targetElement)
      } else {
        // Single line `truncate`
        isElementTruncated = targetElement && targetElement.scrollWidth > targetElement.clientWidth
      }

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
    :overlay-class-name="`nc-tooltip-${color} ${showTooltip ? 'visible' : 'hidden'} ${overlayClassName ?? ''} ${
      !arrow ? 'nc-tooltip-arrow-hidden' : ''
    }`"
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

.nc-tooltip-arrow-hidden {
  .ant-tooltip-arrow {
    @apply hidden;
  }

  &.ant-tooltip-placement-right,
  &.ant-tooltip-placement-rightTop,
  &.ant-tooltip-placement-rightBottom {
    .ant-tooltip-inner {
      @apply -ml-2;
    }
  }

  &.ant-tooltip-placement-left,
  &.ant-tooltip-placement-leftTop,
  &.ant-tooltip-placement-leftBottom {
    .ant-tooltip-inner {
      @apply -mr-2;
    }
  }

  &.ant-tooltip-placement-top,
  &.ant-tooltip-placement-topLeft,
  &.ant-tooltip-placement-topRight {
    .ant-tooltip-inner {
      @apply -mb-2;
    }
  }
  &.ant-tooltip-placement-bottom,
  &.ant-tooltip-placement-bottomLeft,
  &.ant-tooltip-placement-bottomRight {
    .ant-tooltip-inner {
      @apply -mt-2;
    }
  }
}
</style>
