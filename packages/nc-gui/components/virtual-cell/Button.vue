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

const { currentRow } = useSmartsheetRowStoreOrThrow()

const meta = inject(MetaInj, ref())

const isGrid = inject(IsGridInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const { $api } = useNuxtApp()

const rowId = computed(() => {
  return extractPkFromRow(currentRow.value?.row, meta.value?.columns!)
})

const isLoading = ref(false)

const triggerAction = async () => {
  const colOptions = column.value.colOptions

  if (colOptions.type === 'url') {
    const fullUrl = /^(https?|ftp|mailto|file):\/\//.test(props.modelValue)
      ? props.modelValue
      : props.modelValue.trim()
      ? `http://${props.modelValue}`
      : ''

    window.open(fullUrl, '_blank')
  } else if (colOptions.type === 'webhook') {
    try {
      isLoading.value = true

      await $api.dbTableWebhook.trigger(props.modelValue, rowId.value)
    } catch (e) {
      console.error(e)
    } finally {
      isLoading.value = false
    }
  }
}
</script>

<template>
  <div
    :class="{
      'justify-center': isGrid && !isExpandedForm,
    }"
    class="w-full flex items-center"
  >
    <button
      :class="`${column.colOptions.color ?? 'brand'} ${column.colOptions.theme ?? 'solid'}`"
      class="nc-cell-button max-w-28 h-6 min-w-20"
      :disabled="isLoading"
      @click="triggerAction"
    >
      <GeneralLoader
        v-if="isLoading"
        :class="{
          '!text-white': column.colOptions.theme === 'solid',
          '!text-gray': column.colOptions.theme === 'text',
          '!text-gray-700': column.colOptions.theme === 'light',
        }"
        class="flex !bg-inherit"
        size="medium"
      />
      <div v-else class="flex items-center gap-2 justify-center">
        <GeneralIcon :icon="column.colOptions.icon" class="w-4 h-4" />
        {{ column.colOptions.label }}
      </div>
    </button>
  </div>
</template>

<style lang="scss">
.nc-data-cell {
  &:has(.nc-virtual-cell-button) {
    @apply !border-none;
    box-shadow: none !important;
  }

  .nc-cell-attachment {
    @apply !border-none;
  }
}
</style>

<style scoped lang="scss">
.nc-cell-button {
  @apply rounded-lg px-2 flex items-center py-1 justify-center;

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
    @apply text-gray-700;

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
    @apply border-1 border-gray-200;

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
