<script setup lang="ts">
const props = defineProps<{
  modelValue: any[]
}>()

const emits = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emits)

const addHeaderRow = () => vModel.value.push({})
const deleteHeaderRow = (i: number) => vModel.value.splice(i, 1)
</script>

<template>
  <div class="flex flex-col py-3 gap-1.5 w-full">
    <div v-for="(headerRow, idx) in vModel" :key="idx" class="flex relative items-center w-full">
      <a-form-item class="form-item w-8">
        <NcCheckbox v-model:checked="headerRow.enabled" size="large" />
      </a-form-item>
      <a-form-item class="form-item w-3/6">
        <a-input
          v-model:value="headerRow.name"
          :placeholder="$t('placeholder.key')"
          class="!rounded-l-lg nc-input-hook-header-key !border-gray-200"
        />
      </a-form-item>
      <a-form-item class="form-item w-3/6">
        <a-input
          v-model:value="headerRow.value"
          :placeholder="$t('placeholder.value')"
          class="nc-webhook-header-value-input !border-x-0 hover:!border-x-0 !border-gray-200 !rounded-none"
        />
      </a-form-item>

      <NcButton
        class="!rounded-l-none delete-btn !border-gray-200 !shadow-none"
        type="secondary"
        size="small"
        :disabled="vModel.length === 1"
        @click="deleteHeaderRow(idx)"
      >
        <component :is="iconMap.deleteListItem" />
      </NcButton>
    </div>

    <div>
      <NcButton size="small" type="text" @click="addHeaderRow" class="nc-btn-focus">
        <div class="flex flex-row items-center gap-x-2">
          <component :is="iconMap.plus" class="flex-none" />
          <div data-rec="true">{{ $t('general.add') }}</div>
        </div>
      </NcButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ant-input {
  box-shadow: none !important;

  &:hover {
    @apply !hover:bg-gray-50;
  }
}

.delete-btn:not([disabled]) {
  @apply !text-gray-500;
}

.ant-input::placeholder {
  @apply text-gray-500;
}

.ant-input:placeholder-shown {
  @apply text-gray-500 !text-md;
}

:deep(.ant-input.nc-webhook-header-value-input){
  @apply !border-x-0;
}

.ant-input-affix-wrapper {
  @apply px-4 rounded-lg py-2 w-84 border-1 focus:border-brand-500 border-gray-200 !ring-0;
}

.nc-btn-focus:focus {
  @apply !text-brand-500 !shadow-none;
}
</style>
