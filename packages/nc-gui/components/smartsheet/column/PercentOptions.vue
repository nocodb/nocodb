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
  ...vModel.value.meta,
}
</script>

<template>
  <div class="flex flex-col">
    <div>
      <a-checkbox v-if="vModel.meta" v-model:checked="vModel.meta.is_progress" class="ml-1 mb-1">
        <span class="text-[10px] text-gray-600">Display as progress</span>
      </a-checkbox>
    </div>
  </div>
</template>
