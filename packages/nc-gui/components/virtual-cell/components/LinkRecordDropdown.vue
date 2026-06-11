<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  isOpen: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
})

const emits = defineEmits(['update:isOpen'])

const isOpen = useVModel(props, 'isOpen', emits)

const { isMobileMode } = useGlobal()

const ncLinksDropdownRef = ref<HTMLDivElement>()

const randomClass = `link-records_${Math.floor(Math.random() * 99999)}`

const addOrRemoveClass = (add = false) => {
  const dropdownRoot = ncLinksDropdownRef.value?.parentElement?.parentElement?.parentElement?.parentElement as HTMLElement
  if (dropdownRoot) {
    if (add) {
      dropdownRoot.classList.add('inset-0', 'nc-link-dropdown-root', `nc-root-${randomClass}`)
    } else {
      dropdownRoot.classList.remove('inset-0', 'nc-link-dropdown-root', `nc-root-${randomClass}`)
    }
  }
}

// Custom resize handle — CSS resize doesn't work inside Ant dropdown (drag events are intercepted)
const isResizing = ref(false)
const wrapperWidth = ref(0)
const wrapperHeight = ref(0)

const DEFAULT_WIDTH = 540
const DEFAULT_HEIGHT = 412
const MAX_HEIGHT = 700

const onResizeStart = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()

  const wrapper = ncLinksDropdownRef.value
  if (!wrapper) return

  isResizing.value = true
  const startX = e.clientX
  const startY = e.clientY
  const startW = wrapper.offsetWidth
  const startH = wrapper.offsetHeight

  const onMouseMove = (ev: MouseEvent) => {
    ev.preventDefault()
    ev.stopPropagation()

    const newW = Math.max(DEFAULT_WIDTH, Math.min(window.innerWidth * 0.9, startW + (ev.clientX - startX)))
    const newH = Math.max(DEFAULT_HEIGHT, Math.min(MAX_HEIGHT, startH + (ev.clientY - startY)))

    wrapperWidth.value = newW
    wrapperHeight.value = newH
  }

  const onMouseUp = (ev: MouseEvent) => {
    ev.stopPropagation()
    isResizing.value = false
    document.removeEventListener('mousemove', onMouseMove, true)
    document.removeEventListener('mouseup', onMouseUp, true)
  }

  document.addEventListener('mousemove', onMouseMove, true)
  document.addEventListener('mouseup', onMouseUp, true)
}

const wrapperStyle = computed(() => {
  if (isMobileMode.value) return undefined

  const style: Record<string, string> = {}
  if (wrapperWidth.value) style.width = `${wrapperWidth.value}px`
  if (wrapperHeight.value) style.height = `${wrapperHeight.value}px`
  return style
})

watch(
  isOpen,
  (next) => {
    if (next) {
      onClickOutside(document.querySelector(`.${randomClass}`)! as HTMLDivElement, (e) => {
        const targetEl = e?.target as HTMLElement
        if (!targetEl?.classList.contains(`nc-root-${randomClass}`) || targetEl?.closest(`.nc-${randomClass}`)) {
          return
        }
        isOpen.value = false

        addOrRemoveClass(false)
      })
    } else {
      addOrRemoveClass(false)
    }
  },
  { flush: 'post' },
)

watch([ncLinksDropdownRef, isOpen], () => {
  if (!ncLinksDropdownRef.value) return

  if (isOpen.value) {
    addOrRemoveClass(true)
  } else {
    addOrRemoveClass(false)
  }
})
</script>

<template>
  <NcDropdown
    :visible="isOpen"
    placement="bottom"
    :overlay-class-name="`nc-links-dropdown !min-w-[540px] xs:(!min-w-[90vw]) ${isOpen ? 'active' : ''}`"
    :class="`.nc-${randomClass}`"
  >
    <slot />
    <template #overlay>
      <div
        ref="ncLinksDropdownRef"
        class="nc-links-dropdown-wrapper"
        :class="[randomClass, { 'select-none': isResizing }]"
        :style="wrapperStyle"
      >
        <slot name="overlay" />

        <!-- Custom resize handle — absolute so it doesn't add to scroll height -->
        <div class="nc-links-resize-handle" @mousedown="onResizeStart" />
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.nc-links-dropdown {
  @apply rounded-xl !border-nc-border-gray-medium overflow-hidden;
  z-index: 1000 !important;
}
.nc-link-dropdown-root {
  z-index: 1000;
}

.nc-links-dropdown-wrapper {
  @apply h-[412px] w-[540px] xs:(w-[90vw] min-h-[312px] h-[312px]) relative;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 412px;
  max-height: 700px;
  max-width: 90vw;
}

.nc-links-resize-handle {
  @apply absolute bottom-0 right-0 w-4 h-4 z-10 xs:hidden;
  cursor: nwse-resize;
  background-image: linear-gradient(
    135deg,
    transparent 50%,
    var(--nc-content-gray-muted) 50%,
    var(--nc-content-gray-muted) 55%,
    transparent 55%,
    transparent 70%,
    var(--nc-content-gray-muted) 70%,
    var(--nc-content-gray-muted) 75%,
    transparent 75%,
    transparent 90%,
    var(--nc-content-gray-muted) 90%,
    var(--nc-content-gray-muted) 95%,
    transparent 95%
  );
  opacity: 0.5;
}
</style>
