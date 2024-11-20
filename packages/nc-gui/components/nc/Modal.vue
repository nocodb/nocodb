<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    visible: boolean
    width?: string | number
    height?: string | number
    size?: 'small' | 'medium' | 'large' | keyof typeof modalSizes
    destroyOnClose?: boolean
    maskClosable?: boolean
    showSeparator?: boolean
    wrapClassName?: string
    closable?: boolean
    ncModalClassName?: string
    stopEventPropogation?: boolean
  }>(),
  {
    size: 'medium',
    destroyOnClose: true,
    maskClosable: true,
    showSeparator: true,
    wrapClassName: '',
    closable: false,
    ncModalClassName: '',
    stopEventPropogation: false,
  },
)

const emits = defineEmits(['update:visible'])

const { width: propWidth, height: propHeight, destroyOnClose, wrapClassName: _wrapClassName, showSeparator } = props

const { maskClosable, ncModalClassName, stopEventPropogation } = toRefs(props)

const { isMobileMode } = useGlobal()

const ncModalRef = ref<HTMLDivElement | null>(null)

const width = computed(() => {
  if (isMobileMode.value) {
    return '95vw'
  }

  if (propWidth) {
    return propWidth
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

  if (modalSizes[props.size]) {
    return modalSizes[props.size].width
  }

  return 'max(30vw, 600px)'
})

const height = computed(() => {
  if (isMobileMode.value) {
    return '95vh'
  }

  if (propHeight) {
    return propHeight
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

  if (modalSizes[props.size]) {
    return modalSizes[props.size].height
  }

  return 'auto'
})

const newWrapClassName = computed(() => {
  let className = 'nc-modal-wrapper'
  if (_wrapClassName) {
    className += ` ${_wrapClassName}`
  }
  return className
})

const visible = useVModel(props, 'visible', emits)

const slots = useSlots()

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
    :class="{ active: visible }"
    :width="width"
    :centered="true"
    :closable="closable"
    :wrap-class-name="newWrapClassName"
    :footer="null"
    :mask-closable="maskClosable"
    :destroy-on-close="destroyOnClose"
    @keydown.esc="visible = false"
  >
    <div
      ref="ncModalRef"
      class="flex flex-col nc-modal p-6 h-full"
      :class="[`${ncModalClassName}`]"
      :style="{
        maxHeight: height,
        ...(modalSizes[size] ? { height } : {}),
      }"
    >
      <div
        v-if="slots.header"
        :class="{
          'border-b-1 border-gray-200': showSeparator,
        }"
        class="flex pb-2 mb-2 nc-modal-header text-lg font-medium"
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
    @apply !p-0 overflow-hidden;
  }
}
</style>
