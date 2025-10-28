<script setup lang="ts">
const emit = defineEmits<{
  'update:range': [range: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const minValue = ref(selectedWidget.value?.config?.range?.min ?? 0)
const maxValue = ref(selectedWidget.value?.config?.range?.max ?? 100)

const onMinChange = () => {
  emit('update:range', {
    min: minValue.value,
    max: maxValue.value,
  })
}

const onMaxChange = () => {
  emit('update:range', {
    min: minValue.value,
    max: maxValue.value,
  })
}
</script>

<template>
  <div class="flex gap-3">
    <div class="flex flex-col gap-2 flex-1">
      <label class="text-nc-content-gray text-bodyDefaultSm">Minimum</label>
      <a-input-number
        v-model:value="minValue"
        class="!w-full nc-input-shadow !rounded-lg"
        :precision="0"
        @update:value="onMinChange"
      />
    </div>
    <div class="flex flex-col gap-2 flex-1">
      <label class="text-nc-content-gray text-bodyDefaultSm">Maximum</label>
      <a-input-number
        v-model:value="maxValue"
        class="!w-full nc-input-shadow !rounded-lg"
        :precision="0"
        @update:value="onMaxChange"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.ant-input-number-handler-wrap) {
  @apply hidden;
}
</style>
