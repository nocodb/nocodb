<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import { ref, watch } from '#imports'

interface Props {
  // Key to be pressed on hover to trigger the tooltip
  modifierKey?: string
  wrapperClass?: string
}

const { modifierKey, wrapperClass } = defineProps<Props>()

const showTooltip = ref(false)

const isMouseOver = ref(false)

if (modifierKey) {
  onKeyStroke(modifierKey, (e) => {
    e.preventDefault()
    if (modifierKey && isMouseOver.value) {
      showTooltip.value = true
    }
  })
}

watch(isMouseOver, (val) => {
  if (!val) {
    showTooltip.value = false
  }

  // Show tooltip on mouseover if no modifier key is provided
  if (val && !modifierKey) {
    showTooltip.value = true
  }
})
</script>

<template>
  <a-tooltip v-model:visible="showTooltip" :trigger="[]">
    <template #title>
      <slot name="title" />
    </template>
    <div class="w-full" :class="wrapperClass" @mouseenter="isMouseOver = true" @mouseleave="isMouseOver = false">
      <slot />
    </div>
  </a-tooltip>
</template>
