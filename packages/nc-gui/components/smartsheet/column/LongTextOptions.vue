<!-- File not in use for now -->

<script setup lang="ts">
import { useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const richMode = computed({
  get: () => vModel.value.meta?.richMode,
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
  <div class="flex flex-col mt-2 gap-2">
    <a-form-item>
      <div class="flex flex-row items-center">
        <NcSwitch v-model:checked="richMode" :name="$t('labels.enableRichText')" size="small">
          <div class="text-xs">{{ $t('labels.enableRichText') }}</div>
        </NcSwitch>
      </div>
    </a-form-item>
  </div>
</template>
