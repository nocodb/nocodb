<script setup lang="ts">
import { type ColumnType, columnTypeName, isSupportedDisplayValueColumn, isSystemColumn, isVirtualCol } from 'nocodb-sdk'

interface Props {
  value?: boolean
  useMetaFields?: boolean
}

const props = defineProps<Props>()

const { $api } = useNuxtApp()

const { getMeta } = useMetas()

const { eventBus } = useSmartsheetStoreOrThrow()

const { fields } = useViewColumnsOrThrow()

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

const canvasColumn = inject(CanvasColumnInj)

const column = computed(() => menuColumn?.value || canvasColumn?.value)

const selectedFieldId = ref()

const isLoading = ref(false)

const getFormatedColumn = (column: ColumnType) => ({
  title: column.title,
  id: column.id,
  ncItemDisabled: !isSupportedDisplayValueColumn(column) && !column.pv,
  ncItemTooltip:
    !isSupportedDisplayValueColumn(column) && columnTypeName(column) && !column.pv
      ? `${columnTypeName(column)} field cannot be used as display value field`
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

  try {
    await $api.dbTableColumn.primaryColumnSet(selectedFieldId.value)

    await getMeta(meta?.value?.id as string, true)

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    value.value = false
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

const cellIcon = (c: ColumnType) =>
  h(isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: c,
  })

onMounted(() => {
  selectedFieldId.value = useMetaFields.value
    ? meta.value?.columns?.find((c) => c.id === column.value.id)?.id
    : fields.value?.find((f) => f.fk_column_id === column.value.id)?.fk_column_id
})
</script>

<template>
  <NcModal v-model:visible="isVisible" size="small">
    <div class="flex flex-col gap-3">
      <div>
        <h1 class="text-base text-gray-800 font-semibold">{{ $t('labels.searchDisplayValue') }}</h1>
        <div class="text-gray-600 flex items-center gap-1">
          {{ $t('labels.selectYourNewTitleFor') }}

          <span class="bg-gray-100 inline-flex items-center gap-1 px-1 rounded-md">
            <component :is="iconMap.table" />
            {{ meta?.title ?? meta?.table_name }}
          </span>
        </div>
      </div>

      <div class="border-1 rounded-lg border-nc-border-gray-medium h-[250px]">
        <NcList
          v-model:value="selectedFieldId"
          v-model:open="value"
          :list="filteredColumns"
          option-label-key="title"
          option-value-key="id"
          :close-on-select="false"
          class="!w-auto"
          show-search-always
          container-class-name="!max-h-[200px]"
        >
          <template #listItemExtraLeft="{ option }">
            <component :is="cellIcon(option.column)" class="!mx-0 opacity-70" />
          </template>
        </NcList>
      </div>

      <div class="flex w-full gap-2 justify-end">
        <NcButton type="secondary" size="small" @click="value = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          :disabled="!selectedFieldId || selectedFieldId === column.id"
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

<style scoped lang="scss">
.ant-input::placeholder {
  @apply text-gray-500;
}

.ant-input:placeholder-shown {
  @apply text-gray-500 !text-md;
}

.ant-input-affix-wrapper {
  @apply px-4 rounded-lg py-2 w-84 border-1 focus:border-brand-500 border-gray-200 !ring-0;
}
</style>
