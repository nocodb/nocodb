<script setup lang="ts">
import { type ColumnType, columnTypeName, isSupportedDisplayValueColumn, isSystemColumn } from 'nocodb-sdk'

interface Props {
  value?: boolean
  useMetaFields?: boolean
  // preselect this field instead of the menu's column (e.g. a field dropped on the display value slot)
  columnId?: string
  source?: 'menu' | 'drag'
}

const props = defineProps<Props>()

const { fields } = useViewColumnsOrThrow()

const { t } = useI18n()

const { setAsDisplayValue } = useSetDisplayValue()

const meta = inject(MetaInj, ref())

const value = useVModel(props, 'value')

// keep localstate for modal visibility
// if parent component unmouts changing value will not update
const localValue = ref(value.value)
const isVisible = computed({
  get: () => value.value,
  set: (v) => {
    value.value = v
    localValue.value = v
  },
})

const { useMetaFields } = toRefs(props)

const menuColumn = inject(ColumnInj)

const canvasColumn = inject(CanvasColumnInj, ref())

const column = computed(() => menuColumn?.value || canvasColumn?.value)

const selectedFieldId = ref()

const isLoading = ref(false)

const isFieldDropdownOpen = ref(false)

const currentDisplayValueId = computed(() => meta.value?.columns?.find((c) => c.pv)?.id)

const selectedColumn = computed(() => meta.value?.columns?.find((c) => c.id === selectedFieldId.value))

const selectedFieldError = computed(() =>
  selectedColumn.value && !selectedColumn.value.pv && !isSupportedDisplayValueColumn(selectedColumn.value)
    ? t('tooltip.fieldCannotBeUsedAsDisplayValueField', { field: columnTypeName(selectedColumn.value) })
    : '',
)

const currentDisplayValueHint = computed(() =>
  selectedColumn.value?.pv ? t('msg.info.fieldIsCurrentDisplayValue', { field: selectedColumn.value.title }) : '',
)

const getFormatedColumn = (column: ColumnType) => ({
  title: column.title,
  id: column.id,
  ncItemDisabled: !isSupportedDisplayValueColumn(column) && !column.pv,
  ncItemTooltip:
    !isSupportedDisplayValueColumn(column) && columnTypeName(column) && !column.pv
      ? t('tooltip.fieldCannotBeUsedAsDisplayValueField', { field: columnTypeName(column) })
      : '',
  column,
})

const filteredColumns = computed(() => {
  const columns = meta.value?.columnsById ?? {}

  if (useMetaFields.value) {
    return (meta.value?.columns ?? [])
      .filter((c) => c?.id && !isSystemColumn(c))
      .map((column) => {
        return getFormatedColumn(column)
      })
  }

  return (fields.value ?? [])
    .filter((f) => columns[f?.fk_column_id] && !isSystemColumn(columns[f.fk_column_id]))
    .map((f) => {
      return getFormatedColumn(columns[f.fk_column_id] as ColumnType)
    })
})

const changeDisplayField = async () => {
  if (!selectedFieldId.value) return
  isLoading.value = true
  const isUpdated = await setAsDisplayValue(selectedFieldId.value, props.source)
  isLoading.value = false
  if (isUpdated) value.value = false
}

onMounted(() => {
  const preselectId = props.columnId ?? column.value?.id
  selectedFieldId.value = useMetaFields.value
    ? meta.value?.columns?.find((c) => c.id === preselectId)?.id
    : fields.value?.find((f) => f.fk_column_id === preselectId)?.fk_column_id
})
</script>

<template>
  <NcModal v-model:visible="isVisible" size="small">
    <div class="flex flex-col gap-4">
      <h1 class="text-base text-nc-content-gray font-semibold">{{ $t('labels.changeDisplayValueField') }}</h1>

      <a-form layout="vertical" no-style>
        <a-form-item
          :label="$t('labels.displayValueField')"
          class="!mb-0"
          :validate-status="selectedFieldError ? 'error' : ''"
          :help="selectedFieldError ? [selectedFieldError] : undefined"
        >
          <NcListDropdown
            v-model:is-open="isFieldDropdownOpen"
            :has-error="!!selectedFieldError"
            data-testid="nc-display-value-field-select"
          >
            <div class="flex-1 flex items-center gap-2 min-w-0">
              <div v-if="selectedColumn" class="min-w-5 flex items-center justify-center">
                <SmartsheetHeaderIcon :column="selectedColumn" class="!mx-0" color="text-nc-content-gray-muted" />
              </div>
              <NcTooltip hide-on-click class="flex-1 truncate" show-on-truncate-only>
                <template #title>{{ selectedColumn?.title }}</template>
                <span v-if="selectedColumn" class="text-sm truncate text-nc-content-gray">{{ selectedColumn.title }}</span>
                <span v-else class="text-sm truncate text-nc-content-gray-muted">{{ $t('placeholder.selectField') }}</span>
              </NcTooltip>
              <GeneralIcon
                icon="ncChevronDown"
                class="flex-none h-4 w-4 transition-transform opacity-70"
                :class="{ 'transform rotate-180': isFieldDropdownOpen }"
              />
            </div>
            <template #overlay="{ onEsc }">
              <NcList
                v-model:open="isFieldDropdownOpen"
                v-model:value="selectedFieldId"
                :list="filteredColumns"
                option-label-key="title"
                option-value-key="id"
                variant="medium"
                class="!w-auto"
                wrapper-class-name="!h-auto"
                @escape="onEsc"
              >
                <template #listItemExtraLeft="{ option }">
                  <div class="min-w-5 flex items-center justify-center">
                    <SmartsheetHeaderIcon :column="option.column" class="!mx-0" color="text-nc-content-gray-muted" />
                  </div>
                </template>
              </NcList>
            </template>
          </NcListDropdown>
          <div v-if="currentDisplayValueHint" class="w-full mt-1" data-testid="nc-display-value-field-hint">
            <div class="text-xs text-nc-content-gray-muted">{{ currentDisplayValueHint }}</div>
          </div>
        </a-form-item>
      </a-form>

      <div class="flex w-full gap-2 justify-end">
        <NcButton type="secondary" size="small" @click="value = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          :disabled="!selectedFieldId || selectedFieldId === currentDisplayValueId || !!selectedFieldError"
          :loading="isLoading"
          size="small"
          @click="changeDisplayField"
        >
          {{ $t('labels.changeDisplayValueField') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
