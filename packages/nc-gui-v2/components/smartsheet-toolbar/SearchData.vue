<script lang="ts" setup>
import { MetaInj } from '~/context'

const { modelValue, field } = defineProps<{
  modelValue?: string
  field?: any
}>()

const emit = defineEmits(['update:modelValue', 'update:field'])

const localValue = computed({
  get: () => modelValue,
  set: (val) => emit('update:modelValue', val),
})
const localField = computed({
  get: () => field,
  set: (val) => emit('update:field', val),
})

const meta = inject(MetaInj)
const columns = computed(() =>
  meta?.value?.columns?.map((c) => ({
    value: c.id,
    label: c.title,
  })),
)
</script>

<template>
  <a-input v-model:value="localValue" size="small" class="max-w-[250px]" placeholder="Filter query">
    <template #addonBefore>
      <a-select v-model:value="localField" :options="columns" style="width: 80px" class="!text-xs" size="small" />
    </template>
  </a-input>
</template>

<style scoped></style>
