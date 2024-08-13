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

const { isUIAllowed } = useRoles()

const isPublic = inject(IsPublicInj, ref(false))

const { $api } = useNuxtApp()

const rowId = computed(() => {
  return extractPkFromRow(currentRow.value?.row, meta.value!.columns!)
})

const isLoading = ref(false)

const disableButton = computed(() => {
  if (column.value.colOptions.type === 'url') return false
  else {
    return isPublic.value || !isUIAllowed('hookTrigger') || isLoading.value || !column.value.colOptions.fk_webhook_id
  }
})

const isButtonInValid = computed(() => {
  if (column.value.colOptions.type === 'webhook' && !props.modelValue.fk_webhook_id) {
    return true
  }
  return false
})

const triggerAction = async () => {
  const colOptions = column.value.colOptions

  if (colOptions.type === 'webhook') {
    try {
      isLoading.value = true

      await $api.dbTableWebhook.trigger(props.modelValue.fk_webhook_id, rowId.value)
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
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
    <component
      :is="column.colOptions.type === 'url' ? 'a' : 'button'"
      v-bind="{
        ...(column.colOptions.type === 'url'
          ? {
              href: encodeURI(
                /^(https?|ftp|mailto|file):\/\//.test(modelValue.url)
                  ? modelValue.url
                  : modelValue.url.trim()
                  ? `http://${modelValue.url}`
                  : '',
              ),
              target: '_blank',
            }
          : {
              disabled: disableButton || isButtonInValid,
            }),
      }"
      data-testid="nc-button-cell"
      :class="{
        [`${column.colOptions.color ?? 'brand'} ${column.colOptions.theme ?? 'solid'}`]: true,
        '!w-7': !column.colOptions.label,
      }"
      class="nc-cell-button nc-button-cell-link btn-cell-colors truncate flex items-center h-6"
      @click="triggerAction"
    >
      <GeneralLoader
        v-if="isLoading"
        :class="{
          solid: column.colOptions.theme === 'solid',
          text: column.colOptions.theme === 'text',
          light: column.colOptions.theme === 'light',
        }"
        class="flex btn-cell-colors !bg-transparent w-4 h-4"
        size="medium"
      />
      <GeneralIcon v-else-if="column.colOptions.icon" :icon="column.colOptions.icon" class="!w-4 min-w-4 min-h-4 !h-4" />
      <NcTooltip v-if="column.colOptions.label" class="!truncate" show-on-truncate-only>
        <span class="text-[13px] truncate font-medium">
          {{ column.colOptions.label }}
        </span>
        <template #title>
          {{ column.colOptions.label }}
        </template>
      </NcTooltip>
    </component>
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

.nc-button-cell-link {
  @apply !no-underline;
}
</style>

<style scoped lang="scss">
.nc-cell-button {
  @apply rounded-lg px-2 flex items-center gap-2 transition-all justify-center;
  &:not([class*='text']) {
    box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
  }
  &:focus-within {
    box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe;
  }
  &[disabled] {
    @apply !bg-gray-100 text-gray-400;
  }
}

.btn-cell-colors {
  &.solid {
    @apply text-white;

    &[class*='brand'] {
      @apply bg-brand-500 hover:bg-brand-600;
      .nc-loader {
        @apply !text-brand-500;
      }
    }
    &[class*='red'] {
      @apply bg-red-600 hover:bg-red-700;
      .nc-loader {
        @apply !text-red-600;
      }
    }
    &[class*='green'] {
      @apply bg-green-600 hover:bg-green-700;
      .nc-loader {
        @apply !text-green-600;
      }
    }
    &[class*='maroon'] {
      @apply bg-maroon-600 hover:bg-maroon-700;
      .nc-loader {
        @apply !text-maroon-600;
      }
    }
    &[class*='blue'] {
      @apply bg-blue-600 hover:bg-blue-700;
      .nc-loader {
        @apply !text-blue-600;
      }
    }
    &[class*='orange'] {
      @apply bg-orange-600 hover:bg-orange-700;
      .nc-loader {
        @apply !text-orange-600;
      }
    }
    &[class*='pink'] {
      @apply bg-pink-600 hover:bg-pink-700;
      .nc-loader {
        @apply !text-pink-600;
      }
    }
    &[class*='purple'] {
      @apply bg-purple-500 hover:bg-puple-700;
      .nc-loader {
        @apply !text-purple-600;
      }
    }
    &[class*='yellow'] {
      @apply bg-yellow-600 hover:bg-yellow-700;
      .nc-loader {
        @apply !text-yellow-600;
      }
    }
    &[class*='gray'] {
      @apply bg-gray-600 hover:bg-gray-700;
      .nc-loader {
        @apply !text-gray-600;
      }
    }
  }

  &.light {
    @apply text-gray-700;
    box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);

    &[class*='brand'] {
      @apply bg-brand-100 hover:bg-brand-200;
      .nc-loader {
        @apply !text-brand-500;
      }
    }
    &[class*='red'] {
      @apply bg-red-100 hover:bg-red-200;
      .nc-loader {
        @apply !text-red-600;
      }
    }
    &[class*='green'] {
      @apply bg-green-100 hover:bg-green-200;
      .nc-loader {
        @apply !text-green-600;
      }
    }
    &[class*='maroon'] {
      @apply bg-maroon-100 hover:bg-maroon-200;
      .nc-loader {
        @apply !text-maroon-600;
      }
    }
    &[class*='blue'] {
      @apply bg-blue-100 hover:bg-blue-200;
      .nc-loader {
        @apply !text-blue-600;
      }
    }
    &[class*='orange'] {
      @apply bg-orange-100 hover:bg-orange-200;
      .nc-loader {
        @apply !text-orange-600;
      }
    }
    &[class*='pink'] {
      @apply bg-pink-100 hover:bg-pink-200;
      .nc-loader {
        @apply !text-pink-600;
      }
    }
    &[class*='purple'] {
      @apply bg-purple-100 hover:bg-purple-200;
      .nc-loader {
        @apply !text-purple-600;
      }
    }
    &[class*='yellow'] {
      @apply bg-yellow-100 hover:bg-yellow-200;
      .nc-loader {
        @apply !text-yellow-600;
      }
    }
    &[class*='gray'] {
      @apply bg-gray-100 hover:bg-gray-200;
      .nc-loader {
        @apply !text-gray-600;
      }
    }
  }

  &.text {
    &:hover {
      @apply bg-gray-200;
    }
    &:focus {
      box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe;
    }
    &[class*='brand'] {
      @apply text-brand-500;
      .nc-loader {
        @apply !text-brand-500;
      }
    }
    &[class*='red'] {
      @apply text-red-600;
      .nc-loader {
        @apply !text-red-600;
      }
    }
    &[class*='green'] {
      @apply text-green-600;
      .nc-loader {
        @apply !text-green-600;
      }
    }
    &[class*='maroon'] {
      @apply text-maroon-600;
      .nc-loader {
        @apply !text-maroon-600;
      }
    }
    &[class*='blue'] {
      @apply text-blue-600;
      .nc-loader {
        @apply !text-blue-600;
      }
    }
    &[class*='orange'] {
      @apply text-orange-600;
      .nc-loader {
        @apply !text-orange-600;
      }
    }
    &[class*='pink'] {
      @apply text-pink-600;
      .nc-loader {
        @apply !text-pink-600;
      }
    }
    &[class*='purple'] {
      @apply text-purple-500;
      .nc-loader {
        @apply !text-purple-600;
      }
    }
    &[class*='yellow'] {
      @apply text-yellow-600;
      .nc-loader {
        @apply !text-yellow-600;
      }
    }
    &[class*='gray'] {
      @apply text-gray-600;
      .nc-loader {
        @apply !text-gray-600;
      }
    }
  }
}
</style>
