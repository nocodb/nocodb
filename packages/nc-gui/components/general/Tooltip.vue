<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import type { CSSProperties } from '@vue/runtime-dom'
import { ref, useElementHover, watch } from '#imports'

interface Props {
  // Key to be pressed on hover to trigger the tooltip
  modifierKey?: string
  tooltipStyle?: CSSProperties
}

const { modifierKey, tooltipStyle } = defineProps<Props>()

const el = ref()

const showTooltip = ref(false)

const isHovering = useElementHover(() => el.value)

const isKeyPressed = ref(false)

onKeyStroke(
  (e) => e.key === modifierKey,
  (e) => {
    e.preventDefault()
    if (modifierKey && isHovering.value) {
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
    if (modifierKey) {
      showTooltip.value = false
    }

    isKeyPressed.value = false
  },
  { eventName: 'keyup' },
)

watch([isHovering, () => modifierKey], ([hovering, key]) => {
  if (!hovering) {
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
</script>

<template>
  <a-tooltip v-model:visible="showTooltip" :overlay-style="tooltipStyle" :trigger="[]">
    <template #title>
      <slot name="title" />
    </template>

    <div ref="el" class="w-full" :class="$attrs.class" :style="$attrs.style">
      <slot />
    </div>
  </a-tooltip>
</template>
