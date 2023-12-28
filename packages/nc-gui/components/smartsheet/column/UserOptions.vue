<script setup lang="ts">
import { useVModel } from '#imports'

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

const updateIsMulti = (e) => {
  vModel.value.meta.is_multi = e.target.checked
  if (!vModel.value.meta.is_multi) {
    vModel.value.cdf = vModel.value.cdf?.split(',')[0] || null
  }
}
</script>

<template>
  <div class="flex flex-col">
    <div>
      <a-checkbox
        v-if="vModel.meta"
        :checked="vModel.meta.is_multi"
        class="ml-1 mb-1"
        data-testid="user-column-allow-multiple"
        @change="updateIsMulti"
      >
        <span class="text-[10px] text-gray-600">Allow adding multiple users</span>
      </a-checkbox>
    </div>
    <div v-if="future">
      <a-checkbox v-if="vModel.meta" v-model:checked="vModel.meta.notify" class="ml-1 mb-1">
        <span class="text-[10px] text-gray-600">Notify users with base access when they're added</span>
      </a-checkbox>
    </div>
    <div v-if="initialIsMulti && isEdit && !vModel.meta.is_multi" class="text-error text-[10px] mb-1 mt-2">
      <span>Changing from multiple mode to single will retain only first user in each cell!!!</span>
    </div>
  </div>
</template>
