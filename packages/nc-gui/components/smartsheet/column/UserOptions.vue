<script setup lang="ts">
const props = defineProps<{
  value: any
  isEdit: boolean
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const future = ref(false)

const initialIsMulti = ref()

const validators = {}

const { setAdditionalValidations } = useColumnCreateStoreOrThrow()

setAdditionalValidations({
  ...validators,
})

// set default value
vModel.value.meta = {
  is_multi: false,
  notify: false,
  ...vModel.value.meta,
}

onMounted(() => {
  initialIsMulti.value = vModel.value.meta.is_multi
})

const updateIsMulti = (isChecked: boolean) => {
  vModel.value.meta.is_multi = isChecked
  if (!vModel.value.meta.is_multi) {
    vModel.value.cdf = vModel.value.cdf?.split(',')[0] || null
  }
}
</script>

<template>
  <div class="flex flex-col">
    <a-form-item>
      <div v-if="vModel.meta" class="flex items-center gap-1">
        <NcSwitch :checked="vModel.meta.is_multi" @change="updateIsMulti">
          <div class="text-sm text-gray-800 select-none">Allow adding multiple users</div>
        </NcSwitch>
      </div>
    </a-form-item>
    <div v-if="future">
      <a-checkbox v-if="vModel.meta" v-model:checked="vModel.meta.notify" class="ml-1 mb-1">
        <span class="text-[10px] text-gray-600">Notify users with base access when they're added</span>
      </a-checkbox>
    </div>

    <a-alert v-if="initialIsMulti && isEdit && !vModel.meta.is_multi" class="!mt-2" type="warning" show-icon>
      <template #icon><GeneralIcon icon="alertTriangle" class="h-6 w-6" width="24" height="24" /></template>
      <template #message> Alert </template>
      <template #description class="!text-small">
        Changing from multiple mode to single will retain only first user in each cell!
      </template>
    </a-alert>
  </div>
</template>
