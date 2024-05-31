<script lang="ts" setup>
const props = defineProps<{
  value: any
  isVisibleDefaultValueInput: boolean
}>()
const emits = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emits)

const isVisibleDefaultValueInput = useVModel(props, 'isVisibleDefaultValueInput', emits)

const cdfValue = computed({
  get: () => vModel.value.cdf,
  set: (value) => {
    vModel.value.cdf = value
  },
})

const updateCdfValue = (cdf: string | null, hideInput?: boolean) => {
  cdfValue.value = cdf

  if (cdf === null && hideInput) {
    isVisibleDefaultValueInput.value = false
  }
}
</script>

<template>
  <div v-if="!isVisibleDefaultValueInput">
    <NcButton @click.stop="isVisibleDefaultValueInput = true" size="small" type="text" class="!hover:text-gray-700">
      <div class="flex items-center gap-2">
        <span>{{ $t('general.set') }} {{ $t('placeholder.defaultValue') }}</span>
        <GeneralIcon icon="plus" class="flex-none h-4 w-4" />
      </div>
    </NcButton>
  </div>

  <template v-else>
    <div class="w-full flex items-center gap-2 text-gray-600 mb-2">
      <div class="text-sm flex-1 text-gray-800">{{ $t('placeholder.defaultValue') }}</div>
      <GeneralIcon icon="delete" class="flex-none h-4 w-4 cursor-pointer" @click.stop="updateCdfValue(null, true)" />
    </div>
    <div class="flex flex-row gap-2">
      <div
        class="border-1 relative pt-11 flex items-center w-full px-0 border-gray-300 rounded-md max-h-70 pb-1 hover:border-brand-400 focus-within:(border-brand-500 shadow-selected) transition-all duration-0.3s"
      >
        <LazyCellRichText v-model:value="cdfValue" class="border-t-1 border-gray-100 !max-h-80 !min-h-30" show-menu />
      </div>
    </div>
  </template>
</template>
