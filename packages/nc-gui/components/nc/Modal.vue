<script lang="ts" setup>
import type { CSSProperties } from 'vue'

export interface NcModalProps {
  visible: boolean
  width?: string | number
  height?: string | number
  size?: 'small' | 'medium' | 'large' | keyof typeof modalSizes
  destroyOnClose?: boolean
  maskClosable?: boolean
  keyboard?: boolean
  showSeparator?: boolean
  wrapClassName?: string
  closable?: boolean
  ncModalClassName?: string
  stopEventPropogation?: boolean
  class?: string
  maskStyle?: CSSProperties
}

const props = withDefaults(defineProps<NcModalProps>(), {
  size: 'medium',
  destroyOnClose: true,
  maskClosable: true,
  keyboard: true,
  showSeparator: true,
  wrapClassName: '',
  closable: false,
  ncModalClassName: '',
  stopEventPropogation: false,
  class: '',
})

const emits = defineEmits(['update:visible'])

const { destroyOnClose, wrapClassName: _wrapClassName, showSeparator } = props

const { maskClosable, keyboard, ncModalClassName, stopEventPropogation } = toRefs(props)

const { isMobileMode } = useGlobal()

const ncModalRef = ref<HTMLDivElement | null>(null)

const { zIndex, isStacked } = useModalStack(() => props.visible)

// A stacked mask has to bury a lit modal, not just tint the page; set inline because ant renders the mask outside the wrap.
const resolvedMaskStyle = computed<CSSProperties>(() => ({
  ...(isStacked.value ? { backgroundColor: 'rgba(0, 0, 0, 0.93)' } : {}),
  ...(props.maskStyle ?? {}),
}))

const resolvedModalSize = computed(() => {
  const size = modalSizes[props.size as keyof typeof modalSizes]
  if (!size) return null

  if (isMobileMode.value && 'mobile' in size && size.mobile) {
    return size.mobile
  }

  return size
})

const width = computed(() => {
  if (isMobileMode.value && !modalSizes[props.size]) {
    return '95vw'
  }

  if (props.width) {
    return props.width
  }

  if (props.size === 'small') {
    return '28rem'
  }

  if (props.size === 'medium') {
    return '40rem'
  }

  if (props.size === 'large') {
    return '80rem'
  }

  if (resolvedModalSize.value) {
    return resolvedModalSize.value.width
  }

  return 'max(30vw, 600px)'
})

const height = computed(() => {
  if (isMobileMode.value && !modalSizes[props.size]) {
    return '95vh'
  }

  if (props.height) {
    return props.height
  }

  if (props.size === 'small') {
    return 'auto'
  }

  if (props.size === 'medium') {
    return '26.5'
  }

  if (props.size === 'large') {
    return '80vh'
  }

  if (resolvedModalSize.value) {
    return resolvedModalSize.value.height
  }

  return 'auto'
})

const newWrapClassName = computed(() => {
  let className = 'nc-modal-wrapper'
  if (isStacked.value) className += ' nc-modal-stacked'

  if (_wrapClassName) {
    className += ` ${_wrapClassName}`
  }
  return className
})

const visible = useVModel(props, 'visible', emits)

const slots = useSlots()

/**
 * Escape is ours, not ant's.
 *
 * Ant's dialog closes on Escape from a handler on `.ant-modal-wrap` and calls
 * `stopPropagation()` there, so a popup opened from inside the modal — a select
 * list, a dropdown menu, a date picker — never sees the key: the modal closes
 * out from under it. With ant's `keyboard` off we answer here instead, and only
 * ever *decline*: the key is never consumed, so whatever else is listening still
 * gets it.
 *
 * Listening on `document` rather than the wrapper because `@keydown.esc` on
 * `<a-modal>` never fires — it lands on a node the key does not reach, which is
 * why ant's own handler was doing all the work.
 */
function isTopmostModal() {
  const wrap = ncModalRef.value?.closest('.ant-modal-wrap')
  if (!wrap) return false

  const open = Array.from(document.querySelectorAll('.ant-modal-wrap')).filter(
    (el) => window.getComputedStyle(el).display !== 'none',
  )

  return open[open.length - 1] === wrap
}

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || !visible.value || !keyboard.value) return

  // The popup closes itself on this press; the modal takes the next one.
  if (isPortalledOverlayActive()) return

  // Stacked modals: only the one on top answers.
  if (!isTopmostModal()) return

  visible.value = false
})

const stopPropagation = (event: MouseEvent) => {
  event.stopPropagation()
}

if (stopEventPropogation.value) {
  watch(ncModalRef, () => {
    // stop event propogation in edit column
    const modal = document.querySelector('.nc-modal-wrapper') as HTMLElement

    if (visible.value && modal?.parentElement) {
      // modal.parentElement.addEventListener('click', stopPropagation)
      modal.parentElement.addEventListener('mousedown', stopPropagation)
      // modal.parentElement.addEventListener('mouseup', stopPropagation)
    } else if (modal?.parentElement) {
      // modal.parentElement.removeEventListener('click', stopPropagation)
      modal.parentElement.removeEventListener('mousedown', stopPropagation)
      // modal.parentElement.removeEventListener('mouseup', stopPropagation)
    }
  })
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :class="[{ active: visible }, props.class]"
    :width="width"
    :centered="true"
    :closable="closable"
    :wrap-class-name="newWrapClassName"
    :footer="null"
    :mask-closable="maskClosable"
    :mask-style="resolvedMaskStyle"
    :z-index="zIndex"
    :keyboard="false"
    :destroy-on-close="destroyOnClose"
  >
    <div
      ref="ncModalRef"
      class="flex flex-col nc-modal p-4 md:p-6 h-full"
      :class="[`nc-modal-size-${size} ${ncModalClassName}`]"
      :style="{
        maxHeight: height,
        ...(resolvedModalSize ? { height } : {}),
      }"
    >
      <div
        v-if="slots.header"
        :class="{
          'border-b-1 border-nc-border-gray-medium': showSeparator,
        }"
        class="flex pb-2 mb-2 nc-modal-header text-base md:text-lg font-medium"
      >
        <slot name="header" />
      </div>

      <slot />
    </div>
  </a-modal>
</template>

<style lang="scss">
.nc-modal-wrapper {
  .ant-modal-content {
    @apply !p-0;
    // Use `clip`, not `hidden`: an `overflow: hidden` box is still a scroll
    // container, so a focus / scrollIntoView originating from a nested modal or
    // dropdown can scroll THIS chrome box (its content can slightly exceed the
    // fixed modal height) and shove the whole modal body out of view — the box
    // stays centered but its content ends up scrolled ~300px up, leaving a blank
    // modal. `clip` clips identically (border-radius included) but never becomes
    // a scroll container, so scrollTop is pinned at 0. The intended inner scroll
    // areas keep their own `overflow: auto` and are unaffected.
    overflow: clip;
  }
}
</style>
