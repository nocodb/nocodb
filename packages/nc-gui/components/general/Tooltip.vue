<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import type { CSSProperties } from '@vue/runtime-dom'

interface Props {
  // Key to be pressed on hover to trigger the tooltip
  modifierKey?: string
  tooltipStyle?: CSSProperties
  // force disable tooltip
  disabled?: boolean
}

const { modifierKey, tooltipStyle, disabled } = defineProps<Props>()

const el = ref()

const showTooltip = controlledRef(false, {
  onBeforeChange: (shouldShow) => {
    if (shouldShow && disabled) return false
  },
})

const isHovering = useElementHover(() => el.value)

const attrs = useAttrs()

const isKeyPressed = ref(false)

onKeyStroke(
  (e) => e.key === modifierKey,
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
  (e) => e.key === modifierKey,
  (e) => {
    e.preventDefault()

    showTooltip.value = false
    isKeyPressed.value = false
  },
  { eventName: 'keyup' },
)

watch([isHovering, () => modifierKey, () => disabled], ([hovering, key, isDisabled]) => {
  if (!hovering || isDisabled) {
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
})

const divStyles = computed(() => ({
  style: attrs.style as CSSProperties,
  class: attrs.class as string,
}))
</script>

<template>
  <a-tooltip v-model:visible="showTooltip" :overlay-style="tooltipStyle" :trigger="[]">
    <template #title>
      <slot name="title" />
    </template>

    <div ref="el" class="w-full" v-bind="divStyles">
      <slot />
    </div>
  </a-tooltip>
</template>
