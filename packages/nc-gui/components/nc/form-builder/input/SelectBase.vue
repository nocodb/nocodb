<script lang="ts" setup>
const props = defineProps<{
  value: string
  disabled?: boolean
}>()

const emits = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emits)

const basesStore = useBases()

const baseOptions = computed(() => {
  return basesStore.basesList.map((base) => ({
    label: base.title,
    value: base.id,
  }))
})
</script>

<template>
  <NcSelect v-model:value="vModel" :disabled="disabled" :options="baseOptions" />
</template>
