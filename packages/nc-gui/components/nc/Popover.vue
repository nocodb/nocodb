<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useMotion } from '@vueuse/motion'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  placement: {
    type: String,
    default: 'center',
    validator: (value) => ['top', 'bottom', 'left', 'right', 'center'].includes(value),
  },
  offset: {
    type: Array,
    default: () => [0, 10],
  },
  width: {
    type: String,
    default: 'auto',
  },
  zIndex: {
    type: Number,
    default: 1000,
  },
  closeOnClickOutside: {
    type: Boolean,
    default: true,
  },
  closeOnEsc: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['update:modelValue'])

const triggerRef = ref(null)
const popoverRef = ref(null)

const isOpen = useVModel(props, 'modelValue', emit)

const popoverStyle = computed(() => ({
  position: 'fixed',
  zIndex: props.zIndex,
  width: props.width,
}))

const { variant } = useMotion(popoverRef, {
  initial: {
    opacity: 0,
    scale: 0.1,
  },
  enter: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
  leave: {
    opacity: 0,
    scale: 0.1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
})

const updatePopoverPosition = () => {
  if (!triggerRef.value || !popoverRef.value) return

  const triggerRect = triggerRef.value.getBoundingClientRect()
  const popoverRect = popoverRef.value.getBoundingClientRect()

  let top, left

  switch (props.placement) {
    case 'top':
      top = triggerRect.top - popoverRect.height - props.offset[1]
      left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2 + props.offset[0]
      break
    case 'bottom':
      top = triggerRect.bottom + props.offset[1]
      left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2 + props.offset[0]
      break
    case 'left':
      top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2 + props.offset[1]
      left = triggerRect.left - popoverRect.width - props.offset[0]
      break
    case 'right':
      top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2 + props.offset[1]
      left = triggerRect.right + props.offset[0]
      break
    case 'center':
      top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2 + props.offset[1]
      left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2 + props.offset[0]
      break
  }

  // Ensure the popover stays within the viewport
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  top = Math.max(0, Math.min(top, viewportHeight - popoverRect.height))
  left = Math.max(0, Math.min(left, viewportWidth - popoverRect.width))

  Object.assign(popoverRef.value.style, {
    top: `${top}px`,
    left: `${left}px`,
  })
}

const openPopover = () => {
  isOpen.value = true
  nextTick(() => {
    updatePopoverPosition()
    variant.value = 'enter'
  })
}

const closePopover = () => {
  variant.value = 'leave'
  setTimeout(() => {
    isOpen.value = false
  }, 300)
}

const handleClickOutside = (event) => {
  if (
    props.closeOnClickOutside &&
    popoverRef.value &&
    !popoverRef.value.contains(event.target) &&
    !triggerRef.value.contains(event.target)
  ) {
    closePopover()
  }
}

const handleKeyDown = (event) => {
  if (props.closeOnEsc && event.key === 'Escape') {
    closePopover()
  }
}

onMounted(() => {
  if (props.closeOnClickOutside) document.addEventListener('mousedown', handleClickOutside)
  if (props.closeOnEsc) document.addEventListener('keydown', handleKeyDown)
  window.addEventListener('resize', updatePopoverPosition)
  window.addEventListener('scroll', updatePopoverPosition)
})

onUnmounted(() => {
  if (props.closeOnClickOutside) document.removeEventListener('mousedown', handleClickOutside)
  if (props.closeOnEsc) document.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('resize', updatePopoverPosition)
  window.removeEventListener('scroll', updatePopoverPosition)
})

watch(
  () => props.modelValue,
  (newValue) => {
    isOpen.value = newValue
    if (newValue) {
      nextTick(() => {
        updatePopoverPosition()
        variant.value = 'enter'
      })
    } else {
      variant.value = 'leave'
    }
  },
)
</script>

<template>
  <div>
    <div ref="triggerRef" @click="openPopover">
      <slot name="trigger" :open="openPopover" :close="closePopover" :is-open="isOpen">
        <button>Open Popover</button>
      </slot>
    </div>

    <Teleport to="body">
      <div v-if="isOpen" ref="popoverRef" v-motion :style="popoverStyle" class="popover-content">
        <slot name="content" :close="closePopover">
          <div class="p-4">
            <p>Default popover content</p>
            <button @click="closePopover">Close</button>
          </div>
        </slot>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.popover-content {
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
</style>
