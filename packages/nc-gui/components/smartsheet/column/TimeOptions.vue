<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

// set default value
vModel.value.meta = {
  ...columnDefaultMeta[UITypes.Time],
  ...(vModel.value.meta ?? {}),
}

const { isSystem } = useColumnCreateStoreOrThrow()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2 children:flex-1">
      <a-form-item>
        <a-radio-group
          v-if="vModel.meta"
          v-model:value="vModel.meta.is12hrFormat"
          class="nc-time-form-layout"
          :disabled="isSystem"
        >
          <a-radio :value="true">12 Hrs</a-radio>
          <a-radio :value="false">24 Hrs</a-radio>
        </a-radio-group>
      </a-form-item>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-time-form-layout) {
  @apply flex justify-between gap-2 children:(flex-1 m-0 px-2 py-1 border-1 border-gray-300 rounded-lg);

  .ant-radio-wrapper {
    @apply transition-all;
    &:not(.ant-radio-wrapper-disabled).ant-radio-wrapper-checked {
      @apply border-brand-500;
    }
  }
}
</style>
