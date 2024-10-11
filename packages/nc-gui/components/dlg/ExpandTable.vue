<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'

const props = defineProps<{
  fields?: number
  rows?: number
  modelValue: boolean
  affectedRows?: number
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

const close = () => {
  dialogShow.value = false
  emit('cancel')
}
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
    <div data-testid="nc-expand-table-modal" class="flex flex-col mt-1">
      <div v-if="(rows ?? 0) > 0" class="mb-4">
        To fit your pasted data into the table, we need to add
        <span class="font-semibold text-gray-800"> {{ rows }} more records. </span>
      </div>

      <a-radio-group v-if="(rows ?? 0) > 0" v-model:value="expand">
        <a-radio
          data-testid="nc-table-expand-yes"
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
          data-testid="nc-table-expand-no"
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
          <NcButton data-testid="nc-table-expand-cancel" type="secondary" size="small" @click="close">
            {{ $t('labels.cancel') }}
          </NcButton>
        </div>
        <div class="flex gap-2 items-center">
          <NcButton data-testid="nc-table-expand" type="primary" size="small" @click="updateExpand">
            {{ $t('labels.continue') }}
          </NcButton>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style scoped lang="scss"></style>
