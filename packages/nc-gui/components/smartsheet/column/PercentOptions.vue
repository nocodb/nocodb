<script setup lang="ts">
import { useVModel } from '#imports'

const props = defineProps<{
  value: any
  isEdit: boolean
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const validators = {}

const { setAdditionalValidations } = useColumnCreateStoreOrThrow()

setAdditionalValidations({
  ...validators,
})

// set default value
vModel.value.meta = {
  is_progress: false,
  negative: false,
  precision: precisions[2].id,
  ...vModel.value.meta,
}
</script>

<template>
  <div class="flex flex-col">
    <div class="flex flex-row space-x-2">
      <a-form-item class="flex w-full" :label="$t('placeholder.precision')">
        <a-select v-model:value="vModel.meta.precision" dropdown-class-name="nc-dropdown-precision">
          <a-select-option v-for="(precision, i) of precisions" :key="i" :value="precision.id">
            <div class="flex flex-row items-center">
              <div class="text-xs">
                {{ precision.title }}
              </div>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>
    <div class="w-full flex flex-row justify-between items-center mt-2">
      <a-form-item>
        <a-checkbox v-if="vModel.meta" v-model:checked="vModel.meta.is_progress" class="ml-1 mb-1">
          <span class="text-[10px] text-gray-600">Display as progress</span>
        </a-checkbox>
      </a-form-item>
      <a-form-item class="h-full">
        <div class="h-full flex flex-row space-x-2 items-center">
          <a-switch v-model:checked="vModel.meta.negative" :name="$t('labels.negative')" size="small" />
          <div class="text-[10px] text-gray-600">{{ $t('placeholder.allowNegativeNumbers') }}</div>
        </div>
      </a-form-item>
    </div>
  </div>
</template>
