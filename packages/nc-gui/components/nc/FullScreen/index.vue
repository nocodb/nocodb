<script setup lang="ts">
/**
 * @ref: https://github.com/mirari/vue-fullscreen/blob/master/src/component.vue
 * This is same component as vue-fullscreen, but it does not have support to disable esc key.
 */

import type { CSSProperties } from '@vue/runtime-dom'
import { screenfull as sf } from 'vue-fullscreen'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    exitOnClickWrapper?: boolean
    fullscreenClass?: string
    pageOnly?: boolean
    teleport?: boolean
  }>(),
  {
    exitOnClickWrapper: true,
    fullscreenClass: 'fullscreen',
    pageOnly: false,
    teleport: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'change', value: boolean): void
}>()

const sidebarStore = useSidebarStore()

const { isLeftSidebarOpen } = storeToRefs(sidebarStore)

/**
 * State
 */
const isFullscreen = ref(false)

const isEnabled = ref(false)

const wrapper = ref<HTMLElement | null>(null)

const isPageOnly = computed(() => props.pageOnly || !sf.isEnabled)

/**
 * Computed style
 */
const wrapperStyle = computed<CSSProperties | undefined>(() => {
  return (isPageOnly.value || props.teleport) && isFullscreen.value
    ? {
        'position': 'fixed',
        'left': '0',
        'top': '0',
        'width': '100%',
        'height': '100%',
        '--topbar-height': '0px', // We hide the topbar in fullscreen mode, so we need to set it to 0px
      }
    : undefined
})

/**
 * Methods
 */
function request() {
  if (isPageOnly.value) {
    isFullscreen.value = true
    onChangeFullScreen()
    // 🚫 No Escape listener
  } else {
    sf.off('change', fullScreenCallback)
    sf.on('change', fullScreenCallback)
    sf.request(props.teleport ? document.body : wrapper.value!)
  }

  if (props.teleport && wrapper.value) {
    if (wrapper.value.parentNode === document.body) return
    ;(wrapper.value as any).__parentNode = wrapper.value.parentNode
    ;(wrapper.value as any).__token = document.createComment('fullscreen-token')
    ;(wrapper.value.parentNode as Node).insertBefore((wrapper.value as any).__token, wrapper.value)
    document.body.appendChild(wrapper.value)
  }
}

function exit() {
  if (!isFullscreen.value) return
  if (isPageOnly.value) {
    isFullscreen.value = false
    onChangeFullScreen()
  } else {
    sf.exit()
  }
}

function toggle(value?: boolean) {
  if (value === undefined) {
    isFullscreen.value ? exit() : request()
  } else {
    value ? request() : exit()
  }
}

function shadeClick(e: MouseEvent) {
  if (e.target === wrapper.value && props.exitOnClickWrapper) {
    exit()
  }
}

function fullScreenCallback() {
  if (!sf.isFullscreen) {
    sf.off('change', fullScreenCallback)
  }
  isFullscreen.value = sf.isFullscreen
  onChangeFullScreen()
}

function onChangeFullScreen() {
  if (!isFullscreen.value && props.teleport && wrapper.value) {
    const parent = (wrapper.value as any).__parentNode
    const token = (wrapper.value as any).__token

    if (parent && token) {
      parent.insertBefore(wrapper.value, token)
      parent.removeChild(token)
    }
  }

  emit('update:modelValue', isFullscreen.value)
  emit('change', isFullscreen.value)
}

const handleFullScreenChange = async () => {
  const isBrowserFullScreen = !!document.fullscreenElement

  if (isFullscreen.value !== isBrowserFullScreen) {
    isFullscreen.value = isBrowserFullScreen

    onChangeFullScreen()

    isLeftSidebarOpen.value = !isBrowserFullScreen
  }

  if (!supportsKeyboardLock) return

  if (isFullscreen.value) {
    if (ncIsIframe()) {
      window.parent.postMessage({
        type: 'request-fullscreen-esc-key-lock',
      })
    } else {
      await navigator.keyboard.lock(['Escape'])
    }

    return
  }

  if (ncIsIframe()) {
    window.parent.postMessage({
      type: 'request-fullscreen-esc-key-unlock',
    })
  } else {
    navigator.keyboard.unlock()
  }
}

useEventListener(document, 'fullscreenchange', handleFullScreenChange)

/**
 * Watchers
 */
watch(
  () => props.modelValue,
  (val) => {
    if (val !== isFullscreen.value) {
      val ? request() : exit()
    }
  },
)

/**
 * Lifecycle
 */
onMounted(() => {
  isEnabled.value = sf.isEnabled
})

/**
 * Expose
 */
defineExpose({ toggle, request, exit, getState: () => isFullscreen.value })
</script>

<template>
  <div
    ref="wrapper"
    v-bind="$attrs"
    :style="wrapperStyle"
    :class="isFullscreen ? fullscreenClass : ''"
    @click="shadeClick($event)"
  >
    <slot />
  </div>
</template>
