<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'

const props = defineProps<{
  fields?: number
  rows?: number
  modelValue: boolean
}>()

const emit = defineEmits(['update:expand', 'cancel', 'update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const expand = ref(true)

const updateExpand = () => {
  emit('update:expand', expand.value)
  dialogShow.value = false
}

onKeyDown('esc', () => {
  dialogShow.value = false
  emit('update:modelValue', false)
})
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    :header="$t('activity.createTable')"
    size="medium"
    @keydown.esc="dialogShow = false"
  >
    <template #header>
      <div class="flex justify-between w-full items-center">
        <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-gray-800">
          Do you want to expand this table?
        </div>
      </div>
    </template>
    <div class="flex flex-col mt-1">
      <div class="mb-4">
        To fit your pasted data into the table, we need to add

        <span class="font-semibold text-gray-800"> {{ rows }} more records. </span>
      </div>

      <a-radio-group v-model:value="expand">
        <a-radio
          :style="{
            display: 'flex',
            height: '30px',
            lineHeight: '30px',
          }"
          :value="true"
        >
          <div class="text-gray-700">
            <span class="text-gray-800 font-semibold"> Expand the table </span>

            so that all of the pasted cells will fit.
          </div>
        </a-radio>
        <a-radio
          :style="{
            display: 'flex',
            height: '30px',
            lineHeight: '30px',
          }"
          :value="false"
        >
          <span class="text-gray-800 font-semibold"> Don’t expand the table. </span>

          Values outside of the table will not be pasted.
        </a-radio>
      </a-radio-group>

      <div class="flex flex-row justify-end gap-x-2">
        <div class="flex gap-2 items-center">
          <NcButton type="primary" size="small" @click="updateExpand">
            {{ $t('labels.continue') }}
          </NcButton>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
.ant-form-item {
  @apply mb-0;
}

.nc-input-text-area {
  padding-block: 8px !important;
}

.nc-table-advanced-options {
  max-height: 0;
  transition: 0.3s max-height;
  overflow: hidden;

  &.active {
    max-height: 100px;
  }
}
</style>
