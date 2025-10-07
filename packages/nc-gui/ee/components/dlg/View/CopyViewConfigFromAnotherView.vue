<script lang="ts" setup>
import { NcListViewSelector } from '#components'
import {
  extractSupportedViewSettingOverrideOptions,
  getCopyViewConfigOptions,
  type CopyViewConfigOption,
  type ViewSettingOverrideOptions,
  type ViewType,
} from 'nocodb-sdk'

interface Props {
  modelValue?: boolean
  defaultSelectedCopyViewConfigTypes?: ViewSettingOverrideOptions[]
  destView: ViewType
}

const props = withDefaults(defineProps<Props>(), {
  defaultSelectedCopyViewConfigTypes: () => [],
})

const emits = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emits, { defaultValue: false })

const { destView } = toRefs(props)

const { t } = useI18n()

const isLoading = ref(false)

const selectViewRef = ref<InstanceType<typeof NcListViewSelector>>()

const searchField = ref('')

const copyFromViewId = ref<string | undefined>()

const copyFromViewOptions = computed(() =>
  getCopyViewConfigOptions(selectViewRef.value?.selectedView?.type, destView.value?.type),
)

const filteredCopyFromViewOptions = computed(() =>
  copyFromViewOptions.value.filter((option) => searchCompare(t(option.i18nLabel), searchField.value)),
)

const selectedCopyViewConfigTypes = ref<ViewSettingOverrideOptions[]>(props.defaultSelectedCopyViewConfigTypes ?? [])

const toggleCopyViewConfigType = (option: Omit<CopyViewConfigOption, 'supportedViewTypes'>) => {
  if (option.disabled) return

  if (selectedCopyViewConfigTypes.value.includes(option.value)) {
    selectedCopyViewConfigTypes.value = selectedCopyViewConfigTypes.value.filter((v) => v !== option.value)
  } else {
    selectedCopyViewConfigTypes.value.push(option.value)
  }
}

const clearAll = () => {
  selectedCopyViewConfigTypes.value = []
}

const selectAll = () => {
  selectedCopyViewConfigTypes.value = copyFromViewOptions.value.filter((option) => !option.disabled).map((option) => option.value)
}

const copyViewConfiguration = async () => {
  if (ncIsUndefined(selectViewRef.value?.selectedView?.type) || selectedCopyViewConfigTypes.value.length === 0) return

  console.log('selected view config options', selectedCopyViewConfigTypes.value)
}

watch(
  () => selectViewRef.value?.selectedView?.type,
  (sourceViewType) => {
    if (!sourceViewType) return

    selectedCopyViewConfigTypes.value = extractSupportedViewSettingOverrideOptions(
      selectedCopyViewConfigTypes.value,
      sourceViewType,
      destView.value?.type,
    )
  },
)
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    size="small"
    wrap-class-name="nc-copy-view-config-from-another-view-modal-wrapper"
  >
    <template #header>
      <h1 class="text-base text-gray-800 font-semibold flex items-center gap-2">Copy view configuration from another view</h1>
    </template>
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-2">
        <NcListViewSelector
          ref="selectViewRef"
          v-model:value="copyFromViewId"
          :table-id="destView?.fk_model_id"
          :disabled="!destView?.fk_model_id"
        >
          <template #label> Select view </template>
        </NcListViewSelector>
      </div>
      <div class="flex w-full gap-2 justify-between items-center">
        <a-input v-model:value="searchField" class="w-full h-8 flex-1" size="small" placeholder="Search configuration">
          <template #prefix>
            <component :is="iconMap.search" class="w-4 text-gray-500 h-4" />
          </template>
        </a-input>
        <div class="flex items-center gap-2">
          <NcButton
            size="small"
            type="text"
            class="!text-xs"
            :disabled="selectedCopyViewConfigTypes.length === 0"
            @click="clearAll"
          >
            {{ $t('labels.clearAll') }}
          </NcButton>
          <NcButton
            size="small"
            type="text"
            class="!text-xs"
            :disabled="copyFromViewOptions.length === selectedCopyViewConfigTypes.length"
            @click="selectAll"
          >
            {{ $t('general.addAll') }}
          </NcButton>
        </div>
      </div>

      <div class="border-1 rounded-md max-h-[350px] nc-scrollbar-thin border-nc-border-gray-medium">
        <template v-for="option of filteredCopyFromViewOptions" :key="option.value">
          <div
            :data-testid="`nc-copy-view-config-option-${option.value}`"
            class="px-3 py-1 flex flex-row items-center rounded-md"
            :class="{
              'hover:bg-gray-100 cursor-pointer text-nc-content-gray': !option.disabled,
              'cursor-not-allowed text-nc-content-gray-muted': option.disabled,
            }"
            @click.stop="toggleCopyViewConfigType(option)"
          >
            <div class="flex flex-row items-center gap-1 w-full truncate ml-1 py-[5px] pr-2 cursor-inherit">
              <GeneralIcon :icon="option.icon as IconMapKey" class="w-4 h-4 flex-none opacity-80" />
              <NcTooltip class="flex-1 pl-1 pr-2 truncate" show-on-truncate-only>
                <template #title>
                  {{ $t(option.i18nLabel) }}
                </template>
                <template #default>{{ $t(option.i18nLabel) }}</template>
              </NcTooltip>

              <NcCheckbox
                :checked="selectedCopyViewConfigTypes.includes(option.value)"
                size="default"
                :disabled="option.disabled"
              />
            </div>

            <div class="flex-1" />
          </div>
        </template>
        <NcEmptyPlaceholder v-if="!filteredCopyFromViewOptions.length" :subtitle="$t('title.noResultsMatchedYourSearch')">
          <template #icon>
            <img
              src="~assets/img/placeholder/no-search-result-found.png"
              class="!w-[164px] flex-none"
              alt="No search results found"
            />
          </template>
        </NcEmptyPlaceholder>
      </div>

      <div class="flex w-full gap-2 justify-end">
        <NcButton type="secondary" size="small" @click="dialogShow = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton :loading="isLoading" size="small" @click="copyViewConfiguration"> Copy view configuration </NcButton>
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
