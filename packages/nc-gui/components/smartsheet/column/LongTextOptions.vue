<!-- File not in use for now -->

<script setup lang="ts">
const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const richMode = computed({
  get: () => !!vModel.value.meta?.richMode,
  set: (value) => {
    if (!vModel.value.meta) vModel.value.meta = {}

    vModel.value.meta.richMode = value
  },
})

watch(richMode, () => {
  vModel.value.cdf = null
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <a-form-item>
      <div class="flex items-center gap-1">
        <NcSwitch v-model:checked="richMode">
          <div class="text-sm text-gray-800 select-none">
            {{ $t('labels.enableRichText') }}
          </div>
        </NcSwitch>
      </div>
    </a-form-item>
  </div>
</template>
