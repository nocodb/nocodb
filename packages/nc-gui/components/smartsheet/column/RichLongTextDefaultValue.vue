<script lang="ts" setup>
const props = defineProps<{
  value: any
}>()
const emits = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emits)

const cdfValue = computed({
  get: () => vModel.value.cdf,
  set: (value) => {
    vModel.value.cdf = value
  },
})
</script>

<template>
  <div>
    <div class="!my-3 text-xs">{{ $t('placeholder.defaultValue') }}</div>
    <div class="flex flex-row gap-2">
      <div class="border-1 relative pt-11 flex items-center w-full px-0 my-[-4px] border-gray-300 rounded-md !max-h-70 !pb-2.5">
        <LazyCellRichText v-model:value="cdfValue" class="border-t-1 border-gray-100" show-menu full-mode />
      </div>
    </div>
  </div>
</template>
