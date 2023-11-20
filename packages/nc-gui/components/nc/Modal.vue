<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    visible: boolean
    width?: string | number
    size?: 'small' | 'medium' | 'large'
    destroyOnClose?: boolean
    maskClosable?: boolean
  }>(),
  {
    size: 'medium',
    destroyOnClose: true,
    maskClosable: true,
  },
)

const emits = defineEmits(['update:visible'])

const { width: propWidth, destroyOnClose, maskClosable } = props

const { isMobileMode } = useGlobal()

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

  return 'max(30vw, 600px)'
})

const height = computed(() => {
  if (isMobileMode.value) {
    return '95vh'
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

  return 'auto'
})

const visible = useVModel(props, 'visible', emits)

const slots = useSlots()
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :class="{ active: visible }"
    :width="width"
    :centered="true"
    :closable="false"
    wrap-class-name="nc-modal-wrapper"
    :footer="null"
    :mask-closable="maskClosable"
    :destroy-on-close="destroyOnClose"
    @keydown.esc="visible = false"
  >
    <div
      class="flex flex-col nc-modal p-6 h-full"
      :style="{
        maxHeight: height,
      }"
    >
      <div v-if="slots.header" class="flex pb-2 mb-2 text-lg font-medium border-b-1 border-gray-100">
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
  }
}
</style>
