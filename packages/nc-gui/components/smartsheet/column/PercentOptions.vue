<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
  isEdit?: boolean
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
  ...columnDefaultMeta[UITypes.Percent],
  ...(vModel.value.meta || {}),
}
</script>

<template>
  <div class="flex flex-col">
    <a-form-item>
      <div class="flex items-center gap-1">
        <NcSwitch v-if="vModel.meta" v-model:checked="vModel.meta.is_progress">
          <div class="text-sm text-gray-800 select-none">{{ $t('labels.displayAsProgress') }}</div>
        </NcSwitch>
      </div>
    </a-form-item>
  </div>
</template>
