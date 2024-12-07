<script lang="ts" setup>
import { LoadingOutlined } from '@ant-design/icons-vue'

export interface GeneralLoaderProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge' | 'regular' | number
  loaderClass?: string
}

const props = defineProps<GeneralLoaderProps>()

function getFontSize() {
  const { size = 'medium' } = props

  switch (size) {
    case 'small':
      return 'text-xs'
    case 'medium':
      return 'text-sm'
    case 'large':
      return 'text-xl'
    case 'xlarge':
      return 'text-3xl'
    case 'regular':
      return 'text-[16px] leading-4'
  }
}

const indicator = h(LoadingOutlined, {
  class: `!${getFontSize()} flex flex-row items-center !bg-inherit !hover:bg-inherit !text-inherit ${props.loaderClass || ''}}`,
  style: { ...(typeof props.size === 'number' && props.size ? { fontSize: `${props.size}px` } : {}) },
  spin: true,
})
</script>

<template>
  <a-spin class="nc-loader !flex flex-row items-center" :indicator="indicator" />
</template>

<style lang="scss" scoped>
:deep(.anticon-spin) {
  @apply flex;
}
</style>
