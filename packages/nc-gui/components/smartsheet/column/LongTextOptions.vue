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
</script>

<template>
  <div class="flex flex-col mt-2 gap-2">
    <a-form-item>
      <div class="flex flex-row space-x-2 items-center">
        <NcSwitch v-model:checked="richMode" :name="$t('labels.enableRichText')" size="small" />
        <div class="text-xs">{{ $t('labels.enableRichText') }}</div>
      </div>
    </a-form-item>
  </div>
</template>
