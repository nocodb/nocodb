<script lang="ts" setup>
interface Props {
  baseId: string
  sourceId?: string
  showSourceSelector?: boolean
  forceLayout?: 'vertical' | 'horizontal'
}

const props = withDefaults(defineProps<Props>(), {
  showSourceSelector: true,
})

const { baseId } = toRefs(props)

const { t } = useI18n()

const { bases } = storeToRefs(useBases())

const base = computed(() => bases.value.get(baseId.value))

const customSourceId = ref<string | undefined>()

const isOpenSourceSelectDropdown = ref(false)

const sourceList = computed(() => {
  return (base.value?.sources || [])?.map((source, idx) => {
    const isHidden = source.enabled === false

    const ncItemTooltip = isHidden
      ? t('tooltip.sourceVisibilityIsHidden')
      : source.is_schema_readonly
      ? t('tooltip.schemaChangeDisabled')
      : ''

    let sourceLabel = t('general.default')

    if (idx !== 0 && (source.is_meta || source.is_local)) {
      sourceLabel = t('general.base')
    } else if (idx !== 0) {
      sourceLabel = source.alias || source.id!
    }

    return {
      label: sourceLabel,
      value: source.id,
      ncItemDisabled: isHidden || source.is_schema_readonly,
      ncItemTooltip,
      ...source,
    }
  })
})

const selectedSource = computed(() => {
  if (sourceList.value.length < 2) return undefined

  return sourceList.value.find((source) => source.value === customSourceId.value) || sourceList.value[0]
})

onMounted(() => {
  const newSourceId = props.sourceId || sourceList.value[0]?.value

  const sourceObj = sourceList.value.find((source) => source.value === newSourceId)

  // Change source id only if it is default source selected initially and its not enabled
  if (sourceObj && sourceObj.ncItemDisabled && sourceObj.value === sourceList.value[0]?.value) {
    customSourceId.value = sourceList.value.find((source) => !source.ncItemDisabled)?.value || sourceList.value[0]?.value
  } else {
    customSourceId.value = newSourceId
  }
})

defineExpose({
  customSourceId,
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
      :disabled="!showSourceSelector"
      :default-slot-wrapper-class="
        !showSourceSelector
          ? 'text-nc-content-gray-muted cursor-not-allowed bg-nc-bg-gray-light children:opacity-60'
          : 'text-nc-content-gray'
      "
      :has-error="!!selectedSource?.ncItemDisabled"
    >
      <div class="flex-1 flex items-center gap-2">
        <span class="text-sm flex-1">{{ selectedSource?.label || t('general.default') }}</span>

        <GeneralIcon
          icon="ncChevronDown"
          class="flex-none h-4 w-4 transition-transform opacity-70"
          :class="{ 'transform rotate-180': isOpenSourceSelectDropdown }"
        />
      </div>
      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isOpenSourceSelectDropdown"
          :value="customSourceId || selectedSource?.value || ''"
          :list="sourceList"
          variant="medium"
          class="!w-auto"
          wrapper-class-name="!h-auto"
          @update:value="customSourceId = $event as string"
          @escape="onEsc"
        >
        </NcList>
      </template>
    </NcListDropdown>
  </a-form-item>
</template>

<style lang="scss">
.nc-source-selector.ant-form-item {
  &.nc-force-layout-vertical {
    @apply !flex-col;

    & > .ant-form-item-label {
      @apply pb-2 text-left;

      &::after {
        @apply hidden;
      }

      & > label {
        @apply !h-auto;
        &::after {
          @apply !hidden;
        }
      }
    }
  }

  &.nc-force-layout-horizontal {
    @apply !flex-row !items-center;

    & > .ant-form-item-label {
      @apply pb-0 items-center;

      &::after {
        @apply content-[':'] !mr-2 !ml-0.5 relative top-[0.5px];
      }
    }
  }
}
</style>
