<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()
const emits = defineEmits(['update:value'])

provide(EditColumnInj, ref(true))

const vModel = useVModel(props, 'value', emits)
const rowRef = ref({
  row: {},
  oldRow: {},
  rowMeta: {
    isUpdatedFromCopyNPaste: [vModel.value?.title],
  },
})

useProvideSmartsheetRowStore(rowRef)

const cdfValue = ref<string | null>(null)

const editEnabled = ref(false)

const showDefaultValue = ref(false)

const isDefaultValueVisible = computed(() => vModel.value.cdf !== null || showDefaultValue.value)

const updateCdfValue = (cdf: string | null) => {
  vModel.value = { ...vModel.value, cdf }
  cdfValue.value = cdf

  if (cdf === null) {
    showDefaultValue.value = false
  }
}

onMounted(() => {
  updateCdfValue(vModel.value?.cdf ? vModel.value.cdf : null)
})

watch(
  () => vModel.value.cdf,
  (newValue) => {
    cdfValue.value = newValue
  },
)
</script>

<template>
  <div v-if="!isDefaultValueVisible">
    <NcButton @click.stop="showDefaultValue = true" size="small" type="text" class="!hover:text-gray-700">
      <div class="flex items-center gap-2">
        <span>{{ $t('general.set') }} {{ $t('placeholder.defaultValue') }}</span>
        <GeneralIcon icon="plus" class="flex-none h-4 w-4" />
      </div>
    </NcButton>
  </div>
  <template v-else>
    <div class="w-full flex items-center gap-2 text-gray-600">
      <div class="text-sm flex-1 text-gray-700">{{ $t('placeholder.defaultValue') }}</div>
      <GeneralIcon icon="delete" class="flex-none h-4 w-4 cursor-pointer" @click.stop="updateCdfValue(null)" />
    </div>

    <div class="flex flex-row gap-2 mt-2">
      <div
        class="border-1 flex items-center w-full px-3 border-gray-300 rounded-lg sm:min-h-[32px] xs:min-h-13 flex items-center hover:border-brand-400 focus-within:(border-brand-500 shadow-selected ring-0) transition-all duration-0.3s"
        :class="{
          '!border-brand-500': editEnabled,
        }"
      >
        <LazySmartsheetCell
          :edit-enabled="true"
          :model-value="cdfValue"
          :column="vModel"
          class="!border-none h-auto my-auto"
          @update:cdf="updateCdfValue"
          @update:edit-enabled="editEnabled = $event"
          @click="editEnabled = true"
        />
      </div>
    </div>
  </template>
</template>
