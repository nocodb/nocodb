<script setup lang="ts">
import { ButtonActionsType, type ButtonType, type ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'

const column = inject(ColumnInj) as Ref<
  ColumnType & {
    colOptions: ButtonType
  }
>

const cellValue = inject(CellValueInj, ref())

const { currentRow } = useSmartsheetRowStoreOrThrow()

const { generateRows, generatingRows, generatingColumnRows, generatingColumns, aiIntegrations } = useNocoAi()

const meta = inject(MetaInj, ref())

const isGrid = inject(IsGridInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const { isUIAllowed } = useRoles()

const isPublic = inject(IsPublicInj, ref(false))

const { $api } = useNuxtApp()

const rowId = computed(() => {
  return extractPkFromRow(currentRow.value?.row, meta.value!.columns!)
})

const { runScript, activeExecutions, fieldIDRowMapping } = useScriptExecutor()

const automationStore = useAutomationStore()

const { loadAutomation } = automationStore

const isLoading = ref(false)

const pk = computed(() => {
  if (!meta.value?.columns) return
  return extractPkFromRow(currentRow.value?.row, meta.value.columns)
})

const isFieldAiIntegrationAvailable = computed(() => {
  if (column.value?.colOptions?.type !== ButtonActionsType.Ai) return true

  const fkIntegrationId = column.value?.colOptions?.fk_integration_id

  return !!fkIntegrationId
})

const generate = async () => {
  if (!meta?.value?.id || !meta.value.columns || !column?.value?.id) return

  if (!pk.value) return

  const outputColumnIds =
    ncIsString(column.value.colOptions?.output_column_ids) && column.value.colOptions.output_column_ids.split(',').length > 0
      ? column.value.colOptions.output_column_ids.split(',')
      : []
  const outputColumns = outputColumnIds.map((id) => meta.value?.columnsById[id])

  generatingRows.value.push(pk.value)
  generatingColumnRows.value.push(column.value.id)

  generatingColumns.value.push(...(outputColumnIds ?? []))

  const res = await generateRows(meta.value.id, column.value.id, [pk.value])

  if (res?.length) {
    const resRow = res[0]

    if (outputColumnIds) {
      for (const col of outputColumns) {
        if (col && currentRow.value.row) {
          currentRow.value.row[col.title!] = resRow[col.title!]
        }
      }
    }
  }

  generatingRows.value = generatingRows.value.filter((v) => v !== pk.value)
  generatingColumnRows.value = generatingColumnRows.value.filter((v) => v !== column.value.id)
  generatingColumns.value = generatingColumns.value.filter((v) => !outputColumnIds?.includes(v))
}

const isExecutingId = ref('')

const isExecuting = computed(
  () =>
    activeExecutions.value.get(isExecutingId.value)?.status === 'running' ||
    fieldIDRowMapping.value.get(`${pk.value}:${column.value.id}`) === 'running',
)

const triggerAction = async () => {
  const colOptions = column.value.colOptions

  if (colOptions.type === ButtonActionsType.Webhook) {
    try {
      isLoading.value = true

      await $api.dbTableWebhook.trigger(cellValue.value?.fk_webhook_id, rowId!.value)
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  } else if (colOptions.type === ButtonActionsType.Ai) {
    await generate()
  } else if (colOptions.type === ButtonActionsType.Script) {
    try {
      isLoading.value = true

      const script = await loadAutomation(colOptions.fk_script_id)

      const id = await runScript(script, currentRow.value.row, {
        pk: pk.value,
        fieldId: column.value.id,
      })

      isExecutingId.value = id
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  }
}

const componentProps = computed(() => {
  if (column.value.colOptions.type === ButtonActionsType.Url) {
    let url = `${cellValue.value?.url}`
    url = /^(https?|ftp|mailto|file):\/\//.test(url) ? url : url.trim() ? `https://${url}` : ''

    // if url params not encoded, encode them using encodeURI
    try {
      url = decodeURI(url) === url ? encodeURI(url) : url
    } catch {
      url = encodeURI(url)
    }

    return {
      href: url,
      target: '_blank',
      ...(column.value?.colOptions.error ? { disabled: true } : {}),
    }
  } else if (column.value.colOptions.type === ButtonActionsType.Webhook) {
    return {
      disabled:
        isPublic.value ||
        !isUIAllowed('hookTrigger') ||
        isLoading.value ||
        !column.value.colOptions.fk_webhook_id ||
        !cellValue.value?.fk_webhook_id,
    }
  } else if (column.value.colOptions.type === ButtonActionsType.Script) {
    return {
      disabled: isPublic.value || isExecuting.value || !isUIAllowed('dataEdit') || isLoading.value,
    }
  } else if (column.value.colOptions.type === ButtonActionsType.Ai) {
    return {
      disabled:
        isPublic.value ||
        !isUIAllowed('dataEdit') ||
        !isFieldAiIntegrationAvailable.value ||
        isLoading.value ||
        (pk.value &&
          generatingRows.value.includes(pk.value) &&
          column.value?.id &&
          generatingColumnRows.value.includes(column.value.id)),
    }
  }
})
</script>

<template>
  <div
    :class="{
      'justify-center': isGrid && !isExpandedForm,
    }"
    class="w-full flex items-center"
  >
    <NcTooltip :disabled="isFieldAiIntegrationAvailable || isPublic || !isUIAllowed('dataEdit')" class="flex">
      <template #title>
        {{ aiIntegrations.length ? $t('tooltip.aiIntegrationReConfigure') : $t('tooltip.aiIntegrationAddAndReConfigure') }}
      </template>
      <component
        :is="column.colOptions.type === ButtonActionsType.Url ? 'a' : 'button'"
        v-bind="componentProps"
        data-testid="nc-button-cell"
        :class="[
          `${column.colOptions.color ?? 'brand'} ${column.colOptions.theme ?? 'solid'}`,
          { '!w-6': !column.colOptions.label },
        ]"
        class="nc-cell-button nc-button-cell-link btn-cell-colors truncate flex items-center h-6"
        @click="triggerAction"
      >
        <GeneralLoader
          v-if="
            isLoading ||
            isExecuting ||
            (pk && generatingRows.includes(pk) && column?.id && generatingColumnRows.includes(column.id))
          "
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
    </NcTooltip>
  </div>
</template>

<style lang="scss">
.nc-data-cell {
  &:has(.nc-virtual-cell-button) {
    @apply !border-none;
    box-shadow: none !important;

    &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
      box-shadow: none !important;
    }
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
  @apply rounded-md px-2 flex items-center gap-2 transition-all justify-center;
  &:not([class*='text']) {
    box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
  }
  &:focus-within {
    @apply outline-none ring-0;
    box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe;
  }
  &[disabled] {
    @apply !bg-gray-100 text-gray-400;
  }
}

.btn-cell-colors {
  &.solid {
    @apply text-white;

    &.brand {
      @apply bg-brand-500 hover:bg-brand-600;
      .nc-loader {
        @apply !text-brand-500;
      }
    }

    &.red {
      @apply bg-red-600 hover:bg-red-700;
      .nc-loader {
        @apply !text-red-600;
      }
    }

    &.green {
      @apply bg-green-600 hover:bg-green-700;
      .nc-loader {
        @apply !text-green-600;
      }
    }

    &.maroon {
      @apply bg-maroon-600 hover:bg-maroon-700;
      .nc-loader {
        @apply !text-maroon-600;
      }
    }

    &.blue {
      @apply bg-blue-600 hover:bg-blue-700;
      .nc-loader {
        @apply !text-blue-600;
      }
    }

    &.orange {
      @apply bg-orange-600 hover:bg-orange-700;
      .nc-loader {
        @apply !text-orange-600;
      }
    }

    &.pink {
      @apply bg-pink-600 hover:bg-pink-700;
      .nc-loader {
        @apply !text-pink-600;
      }
    }

    &.purple {
      @apply bg-purple-500 hover:bg-purple-700;
      .nc-loader {
        @apply !text-purple-600;
      }
    }

    &.yellow {
      @apply bg-yellow-600 hover:bg-yellow-700;
      .nc-loader {
        @apply !text-yellow-600;
      }
    }

    &.gray {
      @apply bg-gray-600 hover:bg-gray-700;
      .nc-loader {
        @apply !text-gray-600;
      }
    }
  }

  &.light {
    @apply text-gray-700;
    box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);

    &.brand {
      @apply bg-brand-100 hover:bg-brand-200;
      .nc-loader {
        @apply !text-brand-500;
      }
    }

    &.red {
      @apply bg-red-100 hover:bg-red-200;
      .nc-loader {
        @apply !text-red-600;
      }
    }

    &.green {
      @apply bg-green-100 hover:bg-green-200;
      .nc-loader {
        @apply !text-green-600;
      }
    }

    &.maroon {
      @apply bg-maroon-100 hover:bg-maroon-200;
      .nc-loader {
        @apply !text-maroon-600;
      }
    }

    &.blue {
      @apply bg-blue-100 hover:bg-blue-200;
      .nc-loader {
        @apply !text-blue-600;
      }
    }

    &.orange {
      @apply bg-orange-100 hover:bg-orange-200;
      .nc-loader {
        @apply !text-orange-600;
      }
    }

    &.pink {
      @apply bg-pink-100 hover:bg-pink-200;
      .nc-loader {
        @apply !text-pink-600;
      }
    }

    &.purple {
      @apply bg-purple-100 hover:bg-purple-200;
      .nc-loader {
        @apply !text-purple-600;
      }
    }

    &.yellow {
      @apply bg-yellow-100 hover:bg-yellow-200;
      .nc-loader {
        @apply !text-yellow-600;
      }
    }

    &.gray {
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

    &.brand {
      @apply text-brand-500;
      .nc-loader {
        @apply !text-brand-500;
      }
    }

    &.red {
      @apply text-red-600;
      .nc-loader {
        @apply !text-red-600;
      }
    }

    &.green {
      @apply text-green-600;
      .nc-loader {
        @apply !text-green-600;
      }
    }

    &.maroon {
      @apply text-maroon-600;
      .nc-loader {
        @apply !text-maroon-600;
      }
    }

    &.blue {
      @apply text-blue-600;
      .nc-loader {
        @apply !text-blue-600;
      }
    }

    &.orange {
      @apply text-orange-600;
      .nc-loader {
        @apply !text-orange-600;
      }
    }

    &.pink {
      @apply text-pink-600;
      .nc-loader {
        @apply !text-pink-600;
      }
    }

    &.purple {
      @apply text-purple-500;
      .nc-loader {
        @apply !text-purple-600;
      }
    }

    &.yellow {
      @apply text-yellow-600;
      .nc-loader {
        @apply !text-yellow-600;
      }
    }

    &.gray {
      @apply text-gray-600;
      .nc-loader {
        @apply !text-gray-600;
      }
    }
  }
}
</style>
