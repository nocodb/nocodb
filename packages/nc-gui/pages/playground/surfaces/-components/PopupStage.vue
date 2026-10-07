<script setup lang="ts">
/**
 * Renders ant popups (dropdowns, selects, tooltips) inside this box instead of
 * <body>, so a menu opened in a demo scrolls with the page. `openSelector` is
 * clicked once on mount to show the menu open.
 */
const props = withDefaults(
  defineProps<{
    openSelector?: string
    height?: number
  }>(),
  { height: 420 },
)

const stageRef = ref<HTMLElement>()

function getPopupContainer() {
  return stageRef.value ?? document.body
}

/** A menu already showing in this stage — clicking the trigger again would toggle it shut. */
function isPopupOpen() {
  const popups = stageRef.value?.querySelectorAll<HTMLElement>('.ant-dropdown, .ant-popover') ?? []
  return [...popups].some(
    (el) =>
      !el.classList.contains('ant-dropdown-hidden') &&
      !el.classList.contains('ant-popover-hidden') &&
      getComputedStyle(el).display !== 'none',
  )
}

async function open() {
  if (!props.openSelector) return
  // the Reopen click itself counts as an outside click: let that close land, then open again
  for (let waited = 0; isPopupOpen() && waited < 1000; waited += 50) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  if (isPopupOpen()) return
  stageRef.value?.querySelector<HTMLElement>(props.openSelector)?.click()
}

// ant flips/shifts a popup that would overflow the viewport, so wait until the
// stage sits in the upper half of the viewport before the first open
useIntersectionObserver(
  stageRef,
  ([entry], observer) => {
    if (!props.openSelector || !entry?.isIntersecting) return
    observer.disconnect()
    setTimeout(open, 150)
  },
  { rootMargin: '0px 0px -50% 0px' },
)

defineExpose({ open })
</script>

<template>
  <a-config-provider :get-popup-container="getPopupContainer">
    <div ref="stageRef" class="pg-popup-stage relative" :style="{ minHeight: `${height}px` }">
      <slot />
    </div>
  </a-config-provider>
</template>
