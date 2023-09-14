<script lang="ts" setup>
import { LoadingOutlined } from '@ant-design/icons-vue'

const props = defineProps<{
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  loaderClass?: string
}>()

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
  }
}

const indicator = h(LoadingOutlined, {
  class: `!${getFontSize()} flex flex-row items-center !bg-inherit !hover:bg-inherit !text-inherit ${props.loaderClass}}`,
  spin: true,
})
</script>

<template>
  <a-spin class="nc-loader flex flex-row items-center" :indicator="indicator" />
</template>

<style lang="scss" scoped>
:deep(.anticon-spin) {
  @apply flex;
}
</style>
