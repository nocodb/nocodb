<script setup lang="ts">
import type { ButtonType, ColumnType } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: any
}>()

const column = inject(ColumnInj) as Ref<
  ColumnType & {
    colOptions: ButtonType
  }
>

const triggerAction = () => {
  const colOptions = column.value.colOptions

  if (colOptions.type === 'url') {
    const fullUrl = /^(https?|ftp|mailto|file):\/\//.test(props.modelValue)
      ? props.modelValue
      : props.modelValue.trim()
      ? `http://${props.modelValue}`
      : ''

    window.open(fullUrl, '_blank')
  } else if (colOptions.type === 'webhook') {
    // Call webhook
  }
}
</script>

<template>
  <div class="w-full flex items-center justify-center">
    <button
      :class="`${column.colOptions.color ?? 'brand'} ${column.colOptions.theme ?? 'solid'}`"
      class="nc-cell-button"
      @click="triggerAction"
    >
      {{ column.colOptions.label }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.nc-cell-button {
  @apply rounded-md px-2 flex items-center py-1 justify-center;

  &.solid {
    @apply text-white;

    &[class*='brand'] {
      @apply !bg-brand-500;
    }
    &[class*='red'] {
      @apply bg-red-600;
    }
    &[class*='green'] {
      @apply bg-green-600;
    }
    &[class*='maroon'] {
      @apply bg-maroon-600;
    }
    &[class*='blue'] {
      @apply bg-blue-600;
    }
    &[class*='orange'] {
      @apply bg-orange-600;
    }
    &[class*='pink'] {
      @apply bg-pink-600;
    }
    &[class*='purple'] {
      @apply bg-purple-500;
    }
    &[class*='yellow'] {
      @apply bg-yellow-600;
    }
    &[class*='gray'] {
      @apply bg-gray-600;
    }
  }

  &.light {
    @apply text-gray-800;

    &[class*='brand'] {
      @apply bg-brand-200;
    }
    &[class*='red'] {
      @apply bg-red-200;
    }
    &[class*='green'] {
      @apply bg-green-200;
    }
    &[class*='maroon'] {
      @apply bg-maroon-200;
    }
    &[class*='blue'] {
      @apply bg-blue-200;
    }
    &[class*='orange'] {
      @apply bg-orange-200;
    }
    &[class*='pink'] {
      @apply bg-pink-200;
    }
    &[class*='purple'] {
      @apply bg-purple-200;
    }
    &[class*='yellow'] {
      @apply bg-yellow-200;
    }
    &[class*='gray'] {
      @apply bg-gray-200;
    }
  }

  &.text {
    @apply border-1 border-gray-200 rounded;

    &[class*='brand'] {
      @apply text-brand-500;
    }
    &[class*='red'] {
      @apply text-red-600;
    }
    &[class*='green'] {
      @apply text-green-600;
    }
    &[class*='maroon'] {
      @apply text-maroon-600;
    }
    &[class*='blue'] {
      @apply text-blue-600;
    }
    &[class*='orange'] {
      @apply text-orange-600;
    }
    &[class*='pink'] {
      @apply text-pink-600;
    }
    &[class*='purple'] {
      @apply text-purple-500;
    }
    &[class*='yellow'] {
      @apply text-yellow-600;
    }
    &[class*='gray'] {
      @apply text-gray-600;
    }
  }
}
</style>
