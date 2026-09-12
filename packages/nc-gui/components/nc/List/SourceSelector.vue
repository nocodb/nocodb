<script lang="ts" setup>
interface Props {
  baseId: string
  sourceId?: string
  showSourceSelector?: boolean
  forceLayout?: 'vertical' | 'horizontal'
  // When uploading data into an existing table (no DDL), gate on `is_data_readonly`
  // instead of `is_schema_readonly` — schema edit isn't required to append rows.
  importDataOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showSourceSelector: true,
  importDataOnly: false,
})

const emits = defineEmits(['update:sourceId'])

const { baseId } = toRefs(props)

const { t } = useI18n()

const { bases } = storeToRefs(useBases())

const base = computed(() => bases.value.get(baseId.value))

const sourceId = useVModel(props, 'sourceId', emits, {
  defaultValue: undefined,
  passive: true,
})

const isOpenSourceSelectDropdown = ref(false)

const sourceList = computed(() => {
  return (base.value?.sources || [])?.map((source, idx) => {
    const isHidden = source.enabled === false

    const isSchemaReadonly = !!source.is_schema_readonly

    const isDataReadonly = !!source.is_data_readonly

    // Data-only upload writes rows (DML), so it's blocked by a data-readonly source.
    // Creating a new table from the file does DDL + inserts rows, so it's blocked by either.
    const isReadonlyForImport = props.importDataOnly ? isDataReadonly : isSchemaReadonly || isDataReadonly

    let ncItemTooltip = ''
    if (isHidden) {
      ncItemTooltip = t('tooltip.sourceVisibilityIsHidden')
    } else if (isReadonlyForImport) {
      // Schema-readonly is the blocking reason only in the create-table flow; otherwise it's data.
      ncItemTooltip =
        !props.importDataOnly && isSchemaReadonly ? t('tooltip.schemaChangeDisabled') : t('tooltip.dataChangeDisabled')
    }

    let sourceLabel = t('general.default')

    if (idx !== 0 && (source.is_meta || source.is_local)) {
      sourceLabel = t('general.base')
    } else if (idx !== 0) {
      sourceLabel = source.alias || source.id!
    }

    return {
      label: sourceLabel,
      value: source.id,
      ncItemDisabled: isHidden || isReadonlyForImport,
      ncItemTooltip,
      ...source,
    }
  })
})

const selectedSource = computed(() => {
  if (!sourceList.value.length) return undefined

  return sourceList.value.find((source) => sourceId.value && source.value === sourceId.value) || sourceList.value[0]
})

// Data-only upload always targets an existing table, so its source is fixed and must not be changed.
const isSourceChangeable = computed(() => props.showSourceSelector && !props.importDataOnly)

onMounted(() => {
  const newSourceId = sourceId.value || sourceList.value[0]?.value

  const sourceObj = sourceList.value.find((source) => source.value === newSourceId)

  // For data-only upload the target source is fixed (the table's own source) — never auto-switch.
  // Otherwise, if the default source is selected initially but disabled, fall back to the first usable one.
  if (isSourceChangeable.value && sourceObj && sourceObj.ncItemDisabled && sourceObj.value === sourceList.value[0]?.value) {
    sourceId.value = sourceList.value.find((source) => !source.ncItemDisabled)?.value || sourceList.value[0]?.value
  } else {
    sourceId.value = newSourceId
  }
})

const onUpdateValue = (value: string) => {
  sourceId.value = value
}

defineExpose({
  sourceId,
  selectedSource,
  isOpenSourceSelectDropdown,
})
</script>

<template>
  <a-form-item
    v-if="selectedSource"
    name="sourceId"
    class="!mb-0 nc-source-selector"
    :class="`nc-force-layout-${forceLayout}`"
    :validate-status="selectedSource?.ncItemDisabled ? 'error' : ''"
    :help="selectedSource?.ncItemDisabled ? [selectedSource.ncItemTooltip] : []"
    @click.stop
    @dblclick.stop
  >
    <template #label>
      <div>{{ t('general.datasource') }}</div>
    </template>
    <NcListDropdown
      v-model:is-open="isOpenSourceSelectDropdown"
      :disabled="!isSourceChangeable"
      :has-error="!!selectedSource?.ncItemDisabled"
    >
      <div class="flex-1 flex items-center gap-2">
        <span class="text-sm flex-1">{{ selectedSource?.label || t('general.default') }}</span>

        <GeneralIcon
          v-if="isSourceChangeable"
          icon="ncChevronDown"
          class="flex-none h-4 w-4 transition-transform opacity-70"
          :class="{ 'transform rotate-180': isOpenSourceSelectDropdown }"
        />
      </div>
      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isOpenSourceSelectDropdown"
          :value="sourceId || selectedSource?.value || ''"
          :list="sourceList"
          variant="medium"
          class="!w-auto"
          wrapper-class-name="!h-auto"
          @update:value="onUpdateValue($event as string)"
          @escape="onEsc"
        >
        </NcList>
      </template>
    </NcListDropdown>
  </a-form-item>
</template>
