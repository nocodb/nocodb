<script setup lang="ts">
import { ColumnHelper, UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
  isEdit: boolean
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const future = ref(false)

const initialIsMulti = ref()

const validators = {}

const { setAdditionalValidations, updateFieldName } = useColumnCreateStoreOrThrow()

setAdditionalValidations({
  ...validators,
})

// set default value
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.User),
  ...(vModel.value.meta || {}),
}

onMounted(() => {
  initialIsMulti.value = vModel.value.meta.is_multi
})

const updateIsMulti = (isChecked: boolean) => {
  vModel.value.meta.is_multi = isChecked
  if (!vModel.value.meta.is_multi) {
    vModel.value.cdf = vModel.value.cdf?.split(',')[0] || null
  }
  updateFieldName()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <a-form-item>
      <div v-if="vModel.meta" class="flex items-center gap-1">
        <NcSwitch :checked="vModel.meta.is_multi" data-testid="user-column-allow-multiple" @change="updateIsMulti">
          <div class="text-sm text-nc-content-gray select-none">{{ $t('labels.allowAddingMultipleUsers') }}</div>
        </NcSwitch>
      </div>
    </a-form-item>
    <a-form-item v-if="future">
      <div v-if="vModel.meta" class="flex items-center gap-1">
        <NcSwitch v-model:checked="vModel.meta.notify" data-testid="user-column-notify-user">
          <div class="text-sm text-nc-content-gray select-none">{{ $t('labels.notifyUsersWithBaseAccessWhenAdded') }}</div>
        </NcSwitch>
      </div>
    </a-form-item>
    <a-alert v-if="initialIsMulti && isEdit && !vModel.meta.is_multi" type="warning" show-icon>
      <template #icon><GeneralIcon icon="alertTriangle" class="h-6 w-6" width="24" height="24" /></template>
      <template #message> {{ $t('objects.ncMessage.warning') }} </template>
      <template #description> {{ $t('msg.changingMultipleToSingleRetainsFirstUser') }} </template>
    </a-alert>
  </div>
</template>
