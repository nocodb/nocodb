<script setup lang="ts">
import type { AIRecordType, ButtonType, ColumnType } from 'nocodb-sdk'

interface Props {
  modelValue?: AIRecordType | null
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue', 'save'])

const { generateRows, generatingRows, generatingColumnRows, aiIntegrations } = useNocoAi()

const { row } = useSmartsheetRowStoreOrThrow()

const { isUIAllowed } = useRoles()

const isPublic = inject(IsPublicInj, ref(false))

const meta = inject(MetaInj, ref())

const column = inject(ColumnInj) as Ref<
  ColumnType & {
    colOptions: ButtonType
  }
>

const editEnabled = inject(EditModeInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isGallery = inject(IsGalleryInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const vModel = useVModel(props, 'modelValue', emits)

const isAiEdited = ref(false)

const isFieldAiIntegrationAvailable = computed(() => {
  const fkIntegrationId = column.value?.colOptions?.fk_integration_id

  return !!fkIntegrationId
})

const pk = computed(() => {
  if (!meta.value?.columns) return
  return extractPkFromRow(unref(row).row, meta.value.columns)
})

const generate = async () => {
  if (!meta?.value?.id || !meta.value.columns || !column?.value?.id) return

  if (!pk.value) return
  const outputColumnIds =
    ncIsString(column.value.colOptions?.output_column_ids) && column.value.colOptions.output_column_ids.split(',').length > 1
      ? column.value.colOptions.output_column_ids.split(',')
      : []
  const outputColumns = outputColumnIds.map((id) => meta.value?.columnsById?.[id]).filter(Boolean)

  generatingRows.value.push(pk.value)
  generatingColumnRows.value.push(column.value.id)

  const res = await generateRows(meta.value.id, column.value.id, [pk.value], false, !!isExpandedForm.value)

  if (res?.length) {
    const resRow = res[0]

    if (outputColumnIds.length) {
      for (const col of outputColumns) {
        if (col) {
          unref(row).row[col.title!] = resRow[col.title!]
        }
      }
    } else {
      const obj: AIRecordType = resRow[column.value.title!]

      if (ncIsObject(obj)) {
        vModel.value = {
          ...obj,
          isAiEdited: true,
        }
      } else {
        vModel.value = {
          ...(ncIsObject(vModel.value) ? vModel.value : {}),
          isStale: false,
          value: resRow[column.value.title!],
          isAiEdited: true,
          lastModifiedBy: null,
          lastModifiedTime: null,
        }
      }

      setTimeout(() => {
        isAiEdited.value = false
      }, 100)
    }

    emits('save')
  }

  generatingRows.value = generatingRows.value.filter((v) => v !== pk.value)
  generatingColumnRows.value = generatingColumnRows.value.filter((v) => v !== column.value.id)
}

const isLoading = computed(() => {
  return !!(
    pk.value &&
    generatingRows.value.includes(pk.value) &&
    column.value?.id &&
    generatingColumnRows.value.includes(column.value.id)
  )
})

const handleSave = () => {
  vModel.value = { ...vModel.value }

  emits('save')
}

const debouncedSave = useDebounceFn(handleSave, 1000)

const handleDebouncedSave = () => {
  vModel.value!.isAiEdited = false
  isAiEdited.value = true

  debouncedSave()
}

const isDisabledAiButton = computed(() => {
  return !isFieldAiIntegrationAvailable.value || isLoading.value || isPublic.value || !isUIAllowed('dataEdit')
})
</script>

<template>
  <div
    v-if="(!readOnly || isGallery || isKanban) && !vModel"
    class="flex items-center w-full"
    :class="{
      'justify-center': isGrid && !isExpandedForm,
    }"
  >
    <NcTooltip :disabled="isFieldAiIntegrationAvailable || isPublic || isUIAllowed('dataEdit')" class="flex">
      <template #title>
        {{ aiIntegrations.length ? $t('tooltip.aiIntegrationReConfigure') : $t('tooltip.aiIntegrationAddAndReConfigure') }}
      </template>
      <button
        class="nc-cell-ai-button nc-cell-button"
        :class="{
          'is-expanded-form': isExpandedForm,
        }"
        size="small"
        :disabled="isDisabledAiButton"
        @click.stop="generate"
      >
        <div class="flex items-center gap-1">
          <GeneralLoader v-if="isLoading" size="regular" />
          <GeneralIcon v-else icon="ncAutoAwesome" class="h-4 w-4" />
          <span class="leading-[18px] truncate font-medium" :class="{ 'text-sm': isExpandedForm, 'text-small': !isExpandedForm }">
            Generate
          </span>
        </div>
      </button>
    </NcTooltip>
  </div>

  <LazyCellTextArea
    v-else-if="vModel"
    v-model="vModel.value"
    v-model:is-ai-edited="isAiEdited"
    :is-ai="true"
    :ai-meta="vModel"
    :is-field-ai-integration-available="isFieldAiIntegrationAvailable"
    @update:model-value="handleDebouncedSave"
    @generate="generate"
    @close="editEnabled = false"
  />
</template>

<style scoped lang="scss">
.nc-cell-button {
  @apply px-2 flex items-center gap-2 transition-all justify-center bg-nc-bg-purple-light hover:bg-nc-bg-purple-dark text-nc-content-purple-medium;

  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);

  .nc-loader {
    @apply !text-nc-content-purple-dark;
  }

  &.is-expanded-form {
    @apply h-8 rounded-lg my-1;
  }

  &:not(.is-expanded-form) {
    @apply h-6 rounded-md;
  }

  &:focus-within {
    @apply outline-none ring-0;
    box-shadow: 0px 0px 0px 2px var(--nc-bg-default), 0px 0px 0px 4px var(--color-purple-500);
  }

  &[disabled] {
    @apply !bg-gray-100 opacity-50;
  }
}
</style>

<style lang="scss">
.nc-data-cell {
  &:has(.nc-cell-ai-button) {
    @apply !border-none;
    box-shadow: none !important;

    &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
      box-shadow: none !important;
    }
  }

  &:has(.nc-cell-ai-button.is-expanded-form) {
    @apply -mt-1 -ml-1;
  }
}
</style>
