<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    visible: boolean
    width?: string | number
    size?: 'small' | 'medium' | 'large' | 'xl'
    destroyOnClose?: boolean
    maskClosable?: boolean
    closable?: boolean
    keyboard?: boolean
  }>(),
  {
    size: 'medium',
    destroyOnClose: true,
    maskClosable: true,
    closable: false,
    keyboard: true,
  },
)

const emits = defineEmits(['update:visible'])

const { width: propWidth } = props
const { maskClosable, closable, keyboard, destroyOnClose } = toRefs(props)

const width = computed(() => {
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

  if (props.size === 'xl') {
    return '80rem'
  }

  return 'max(30vw, 600px)'
})

const height = computed(() => {
  if (props.size === 'small') {
    return 'auto'
  }

  if (props.size === 'medium') {
    return '26.5'
  }

  if (props.size === 'large') {
    return '80vh'
  }
  if (props.size === 'xl') {
    return '90vh'
  }

  return 'auto'
})

const visible = useVModel(props, 'visible', emits)
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :class="{ active: visible }"
    :width="width"
    :closable="closable"
    :keyboard="keyboard"
    wrap-class-name="nc-modal-wrapper"
    :footer="null"
    :destroy-on-close="destroyOnClose"
    :mask-closable="maskClosable"
    @keydown.esc="visible = false"
  >
    <div :class="`nc-modal h-[${height}] max-h-[${height}]`">
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
