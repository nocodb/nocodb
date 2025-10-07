<script lang="ts" setup>
import { NcListViewSelector } from '#components'

interface Props {
  modelValue?: boolean
  defaultSelectedCopyViewConfigTypes?: CopyViewConfigType[]
  tableId?: string
}

const props = withDefaults(defineProps<Props>(), {
  defaultSelectedCopyViewConfigTypes: () => [],
})

const emits = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emits, { defaultValue: false })

const { t } = useI18n()

const isLoading = ref(false)

const selectViewRef = ref<InstanceType<typeof NcListViewSelector>>()

const searchField = ref('')

const copyFromViewId = ref<string | undefined>()

const copyFromViewOptions = computed(() => getCopyViewConfigOptions(selectViewRef.value?.selectedView?.type))

const selectedCopyViewConfigTypes = ref<CopyViewConfigType[]>(props.defaultSelectedCopyViewConfigTypes ?? [])

const toggleCopyViewConfigType = (value: CopyViewConfigType) => {
  if (selectedCopyViewConfigTypes.value.includes(value)) {
    selectedCopyViewConfigTypes.value = selectedCopyViewConfigTypes.value.filter((v) => v !== value)
  } else {
    selectedCopyViewConfigTypes.value.push(value)
  }
}

const clearAll = () => {
  selectedCopyViewConfigTypes.value = []
}

const selectAll = () => {
  if (ncIsUndefined(selectViewRef.value?.selectedView?.type)) return

  selectedCopyViewConfigTypes.value = copyFromViewOptions.value.filter((option) => !option.disabled).map((option) => option.value)
}

const copyViewConfiguration = async () => {
  if (ncIsUndefined(selectViewRef.value?.selectedView?.type) || selectedCopyViewConfigTypes.value.length === 0) return

  console.log('selected view config options', selectedCopyViewConfigTypes.value)
}
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
        <NcListViewSelector ref="selectViewRef" v-model:value="copyFromViewId" :table-id="tableId" :disabled="!tableId">
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
          <NcButton size="small" type="text" class="!text-xs" @click="clearAll"> {{ $t('labels.clearAll') }} </NcButton>
          <NcButton size="small" type="text" class="!text-xs" @click="selectAll"> {{ $t('general.addAll') }} </NcButton>
        </div>
      </div>

      <div class="border-1 rounded-md max-h-[350px] nc-scrollbar-thin border-nc-border-gray-medium">
        <template v-for="option of copyFromViewOptions" :key="option.value">
          <div
            v-if="searchCompare($t(option.i18nLabel), searchField)"
            :data-testid="`nc-copy-view-config-option-${option.value}`"
            class="px-3 py-1 flex flex-row items-center rounded-md"
            :class="{
              'hover:bg-gray-100': !option.disabled,
            }"
            @click.stop="toggleCopyViewConfigType(option.value)"
          >
            <div class="flex flex-row items-center w-full cursor-pointer truncate ml-1 py-[5px] pr-2">
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
