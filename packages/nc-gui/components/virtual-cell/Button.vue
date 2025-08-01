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

const { appInfo } = useGlobal()

const meta = inject(MetaInj, ref())

const isGrid = inject(IsGridInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const { isUIAllowed } = useRoles()

const isPublic = inject(IsPublicInj, ref(false))

const { $api } = useNuxtApp()

const { t } = useI18n()

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

const isAiButtonType = computed(() => column.value?.colOptions?.type === ButtonActionsType.Ai)

const isFieldAiIntegrationAvailable = computed(() => {
  if (!isAiButtonType.value) return true

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

const invalidUrlTooltip = ref('')

const componentProps = computed(() => {
  if (column.value.colOptions.type === ButtonActionsType.Url) {
    let url = addMissingUrlSchma(cellValue.value?.url)

    // if url params not encoded, encode them using encodeURI
    try {
      url = decodeURI(url) === url ? encodeURI(url) : url
    } catch {
      url = encodeURI(url)
    }

    const isValidUrl = isValidURL(url, { require_tld: !appInfo.value?.allowLocalUrl })

    invalidUrlTooltip.value = !isValidUrl ? t('msg.error.invalidURL') : ''

    return {
      href: url,
      target: '_blank',
      ...(column.value?.colOptions.error || !isValidUrl ? { disabled: true } : {}),
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

const afterActionStatus = ref<{
  status: 'success' | 'error'
  tooltip?: string
} | null>(null)

const triggerAction = async () => {
  const colOptions = column.value.colOptions
  afterActionStatus.value = null

  if (colOptions.type === ButtonActionsType.Url) {
    confirmPageLeavingRedirect(componentProps.value?.href, componentProps.value?.target, appInfo.value?.allowLocalUrl)
  } else if (colOptions.type === ButtonActionsType.Webhook) {
    try {
      isLoading.value = true

      await $api.dbTableWebhook.trigger(cellValue.value?.fk_webhook_id, rowId!.value)

      afterActionStatus.value = { status: 'success' }
      ncDelay(2000).then(() => {
        afterActionStatus.value = null
      })
    } catch (e: any) {
      console.log(e)

      const errorMsg = await extractSdkResponseErrorMsg(e)
      message.error(errorMsg)

      afterActionStatus.value = { status: 'error', tooltip: errorMsg }
      ncDelay(3000).then(() => {
        afterActionStatus.value = null
      })
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

      afterActionStatus.value = { status: 'success' }
      ncDelay(2000).then(() => {
        afterActionStatus.value = null
      })
    } catch (e: any) {
      console.log(e)

      const errorMsg = await extractSdkResponseErrorMsg(e)
      message.error(errorMsg)

      afterActionStatus.value = { status: 'error', tooltip: errorMsg }
      ncDelay(3000).then(() => {
        afterActionStatus.value = null
      })
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
    <NcTooltip
      :disabled="
        isAiButtonType
          ? isFieldAiIntegrationAvailable || isPublic || !isUIAllowed('dataEdit')
          : !invalidUrlTooltip && !afterActionStatus?.tooltip
      "
      class="flex"
    >
      <template #title>
        {{
          isAiButtonType
            ? aiIntegrations.length
              ? $t('tooltip.aiIntegrationReConfigure')
              : $t('tooltip.aiIntegrationAddAndReConfigure')
            : afterActionStatus?.tooltip || invalidUrlTooltip
        }}
      </template>
      <component
        :is="column.colOptions.type === ButtonActionsType.Url ? 'a' : 'button'"
        v-bind="componentProps"
        data-testid="nc-button-cell"
        :class="[
          `${column.colOptions.color ?? 'brand'} ${column.colOptions.theme ?? 'solid'}`,
          { '!w-6': !column.colOptions.label, 'disabled': componentProps.disabled },
        ]"
        class="nc-cell-button nc-button-cell-link btn-cell-colors truncate flex items-center h-6"
        @click.prevent="triggerAction"
      >
        <GeneralIcon
          v-if="afterActionStatus"
          :icon="afterActionStatus.status === 'success' ? 'ncCheck' : 'ncInfo'"
          class="w-4 h-4 flex-none text-current"
        />
        <GeneralLoader
          v-else-if="
            isLoading ||
            isExecuting ||
            (pk && generatingRows.includes(pk) && column?.id && generatingColumnRows.includes(column.id))
          "
          class="flex w-4 h-4 !text-current"
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
    @apply opacity-50;
  }
}

.btn-cell-colors {
  &.solid {
    @apply text-white;

    &.brand {
      @apply bg-brand-500 hover:not(.disabled):bg-brand-600;
    }

    &.red {
      @apply bg-red-600 hover:not(.disabled):bg-red-700;
    }

    &.green {
      @apply bg-green-600 hover:not(.disabled):bg-green-700;
    }

    &.maroon {
      @apply bg-maroon-600 hover:not(.disabled):bg-maroon-700;
    }

    &.blue {
      @apply bg-blue-600 hover:not(.disabled):bg-blue-700;
    }

    &.orange {
      @apply bg-orange-600 hover:not(.disabled):bg-orange-700;
    }

    &.pink {
      @apply bg-pink-600 hover:not(.disabled):bg-pink-700;
    }

    &.purple {
      @apply bg-purple-500 hover:not(.disabled):bg-purple-700;
    }

    &.yellow {
      @apply bg-yellow-600 hover:not(.disabled):bg-yellow-700;
    }

    &.gray {
      @apply bg-gray-600 hover:not(.disabled):bg-gray-700;
    }
  }

  &.light {
    box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);

    &.brand {
      @apply bg-brand-50 hover:not(.disabled):bg-brand-100 !text-brand-600;
    }

    &.red {
      @apply bg-red-50 hover:not(.disabled):bg-red-100 !text-red-600;
    }

    &.green {
      @apply bg-green-50 hover:not(.disabled):bg-green-100 !text-green-600;
    }

    &.maroon {
      @apply bg-maroon-50 hover:not(.disabled):bg-maroon-100 !text-maroon-600;
    }

    &.blue {
      @apply bg-blue-50 hover:not(.disabled):bg-blue-100 !text-blue-600;
    }

    &.orange {
      @apply bg-orange-50 hover:not(.disabled):bg-orange-100 !text-orange-600;
    }

    &.pink {
      @apply bg-pink-50 hover:not(.disabled):bg-pink-100 !text-pink-600;
    }

    &.purple {
      @apply bg-purple-50 hover:not(.disabled):bg-purple-100 !text-purple-600;
    }

    &.yellow {
      @apply bg-yellow-50 hover:not(.disabled):bg-yellow-100 !text-yellow-600;
    }

    &.gray {
      @apply bg-gray-50 hover:not(.disabled):bg-gray-100 !text-gray-600;
    }
  }

  &.text {
    &:hover:not(.disabled) {
      @apply bg-gray-200;
    }
    &:focus {
      box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe;
    }

    &.brand {
      @apply text-brand-500;
    }

    &.red {
      @apply text-red-600;
    }

    &.green {
      @apply text-green-600;
    }

    &.maroon {
      @apply text-maroon-600;
    }

    &.blue {
      @apply text-blue-600;
    }

    &.orange {
      @apply text-orange-600;
    }

    &.pink {
      @apply text-pink-600;
    }

    &.purple {
      @apply text-purple-500;
    }

    &.yellow {
      @apply text-yellow-600;
    }

    &.gray {
      @apply text-gray-600;
    }
  }
}
</style>
