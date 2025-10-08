<script lang="ts" setup>
import { extractSupportedViewSettingOverrideOptions, getCopyViewConfigOptions, viewTypeAlias } from 'nocodb-sdk'
import type { CopyViewConfigOption, ViewSettingOverrideOptions, ViewType, ViewTypes } from 'nocodb-sdk'
import { NcListViewSelector } from '#components'

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

const { $api } = useNuxtApp()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const isLoading = ref(false)

const selectViewRef = ref<InstanceType<typeof NcListViewSelector>>()

const copyFromViewId = ref<string | undefined>()

const copyFromViewOptions = computed(() =>
  getCopyViewConfigOptions(selectViewRef.value?.selectedView?.type, destView.value?.type),
)

const selectedCopyViewConfigTypes = ref<ViewSettingOverrideOptions[]>(props.defaultSelectedCopyViewConfigTypes ?? [])

// better variable name for the computed value
const copyViewConfigSelectionStatus = computed(() => {
  return {
    isAllSelected:
      selectedCopyViewConfigTypes.value.length === copyFromViewOptions.value.filter((option) => !option.disabled).length,
    isSomeSelected: selectedCopyViewConfigTypes.value.length > 0,
  }
})

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
  if (
    ncIsUndefined(selectViewRef.value?.selectedView?.type) ||
    selectedCopyViewConfigTypes.value.length === 0 ||
    !destView.value
  ) {
    return
  }

  try {
    const response = await $api.internal.postOperation(
      activeWorkspaceId.value!,
      destView.value.base_id!,
      {
        operation: 'viewSettingOverride',
      },
      {
        destinationViewId: destView.value.id!,
        sourceViewId: copyFromViewId.value!,
        settingToOverride: selectedCopyViewConfigTypes.value,
      },
    )
  } catch (e) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
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
    <div class="flex flex-col gap-5">
      <h1 class="text-base text-nc-content-gray-emphasis font-semibold flex items-center gap-2 mb-0">
        {{ $t('objects.copyViewConfig.copyConfigurationFromAnotherView') }}
      </h1>

      <div class="flex flex-col gap-2">
        <NcListViewSelector
          ref="selectViewRef"
          v-model:value="copyFromViewId"
          :table-id="destView?.fk_model_id"
          :disabled="!destView?.fk_model_id"
          :filter-view="(view) => view.id !== destView.id"
          force-layout="vertical"
        >
          <template #label>
            <span class="text-body text-nc-content-gray">{{ $t('objects.copyViewConfig.selectViewToCopyFrom') }}</span>
          </template>
        </NcListViewSelector>
      </div>

      <div>
        <div class="text-body text-nc-content-gray pb-2">
          {{ $t('objects.copyViewConfig.selectConfigurationToCopy') }}
        </div>

        <NcTooltip
          v-for="option of copyFromViewOptions"
          :key="option.value"
          :data-testid="`nc-copy-view-config-option-${option.value}`"
          class="flex flex-row items-center rounded-md transition select-none"
          :class="{
            'hover:bg-gray-100 cursor-pointer text-nc-content-gray': !option.disabled,
            'cursor-not-allowed text-nc-content-gray-muted': option.disabled,
          }"
          :title="$t('objects.copyViewConfig.notSupportedByViewType', { view: viewTypeAlias[selectViewRef?.selectedView?.type as ViewTypes] ?$t(`objects.viewType.${viewTypeAlias[selectViewRef?.selectedView?.type as ViewTypes]}`) : $t('general.selected') })"
          placement="left"
          :disabled="!option.disabled || !selectViewRef?.selectedView?.type"
          @click.stop="toggleCopyViewConfigType(option)"
        >
          <div
            class="flex flex-row items-center gap-1 w-full truncate py-[7px] px-2 cursor-inherit text-bodyDefaultSm font-medium"
          >
            <span class="flex children:flex-none mr-2" @click.stop="toggleCopyViewConfigType(option)">
              <NcSwitch
                :checked="selectedCopyViewConfigTypes.includes(option.value)"
                :disabled="option.disabled"
                size="xxsmall"
              />
            </span>

            <GeneralIcon :icon="option.icon as IconMapKey" class="w-4 h-4 flex-none opacity-80" />
            <NcTooltip class="flex-1 pl-1 pr-2 truncate" show-on-truncate-only>
              <template #title>
                {{ $t(option.i18nLabel) }}
              </template>
              <template #default>{{ $t(option.i18nLabel) }}</template>
            </NcTooltip>
          </div>
        </NcTooltip>

        <div class="flex items-center gap-2 mt-2">
          <NcButton
            size="xs"
            type="text"
            class="!font-normal"
            :disabled="copyViewConfigSelectionStatus.isAllSelected"
            @click="selectAll"
          >
            {{ $t('general.selectAll') }}
          </NcButton>
          <NcButton
            size="xs"
            type="text"
            class="!font-normal"
            :disabled="!copyViewConfigSelectionStatus.isSomeSelected"
            @click="clearAll"
          >
            {{ $t('labels.clearAll') }}
          </NcButton>
        </div>
      </div>

      <div class="flex w-full gap-2 justify-end">
        <NcButton type="secondary" size="small" @click="dialogShow = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          :loading="isLoading"
          size="small"
          :disabled="!copyFromViewId || selectedCopyViewConfigTypes.length === 0"
          @click="copyViewConfiguration"
        >
          {{ $t('labels.copyConfiguration') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
