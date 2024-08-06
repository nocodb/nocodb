<script setup lang="ts">
const props = defineProps<{
  modelValue: any[]
}>()

const emits = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emits)

const addParamRow = () => vModel.value.push({})

const deleteParamRow = (i: number) => {
  if (vModel.value.length === 1) return

  vModel.value.splice(i, 1)
}
</script>

<template>
  <div class="flex flex-col py-4 gap-3 w-full">
    <div v-for="(paramRow, idx) in vModel" :key="idx" class="flex relative items-center w-full">
      <a-form-item class="form-item w-8">
        <NcCheckbox v-model:checked="paramRow.enabled" size="large" />
      </a-form-item>
      <a-form-item class="form-item w-3/6">
        <a-input v-model:value="paramRow.name" :placeholder="$t('placeholder.key')" class="!rounded-l-lg" />
      </a-form-item>
      <a-form-item class="form-item w-3/6">
        <a-input v-model:value="paramRow.value" :placeholder="$t('placeholder.value')" class="!border-x-0 !rounded-none" />
      </a-form-item>

      <NcButton
        class="!rounded-l-none"
        type="secondary"
        size="small"
        :disabled="vModel.length === 1"
        @click="deleteParamRow(idx)"
      >
        <component :is="iconMap.delete" />
      </NcButton>
    </div>

    <NcButton size="small" type="secondary" class="!w-36" @click="addParamRow">
      <div class="flex flex-row items-center gap-x-1">
        <div data-rec="true">{{ $t('activity.addParameter') }}</div>
        <component :is="iconMap.plus" class="flex mx-auto" />
      </div>
    </NcButton>
  </div>
</template>

<style lang="scss" scoped>
.ant-input:hover {
  @apply !hover:bg-gray-50
  box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
}

.ant-input::placeholder {
  @apply text-gray-500;
}

.ant-input:placeholder-shown {
  @apply text-gray-500 !text-md;
}

.ant-input-affix-wrapper {
  @apply px-4 rounded-lg py-2 w-84 border-1 focus:border-brand-500 border-gray-200 !ring-0;
}
</style>
