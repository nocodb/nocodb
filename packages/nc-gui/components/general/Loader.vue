<script lang="ts" setup>
import { LoadingOutlined } from '@ant-design/icons-vue'

const props = defineProps<{
  size?: 'small' | 'medium' | 'large' | 'xlarge'
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
  class: `!text-gray-400 !${getFontSize()}`,
  spin: true,
})
</script>

<template>
  <a-spin class="nc-loader !flex !flex-row !items-center !my-0.5 !mx-1.5 w-8" :indicator="indicator" />
</template>
