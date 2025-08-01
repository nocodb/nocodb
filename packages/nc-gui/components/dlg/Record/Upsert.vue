<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'
import { PermissionEntity, PermissionKey, type TableType } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    newRows: number
    modelValue: boolean
    newColumns: number
    cellsOverwritten: number
    rowsUpdated: number
    isAddingEmptyRowPermitted?: boolean
    meta: TableType
  }>(),
  {
    isAddingEmptyRowPermitted: true,
  },
)

const emit = defineEmits(['update:expand', 'cancel', 'update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const { isAddingEmptyRowPermitted } = toRefs(props)

const { showRecordPlanLimitExceededModal } = useEeConfig()

const expand = ref(isAddingEmptyRowPermitted.value)

const updateExpand = () => {
  if (
    expand.value &&
    showRecordPlanLimitExceededModal({
      callback(type) {
        if (type === 'ok') {
          dialogShow.value = false
        }
      },
    })
  ) {
    return
  }

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
    v-if="dialogShow"
    v-model:visible="dialogShow"
    :show-separator="false"
    :header="$t('activity.createTable')"
    size="small"
    @keydown.esc="dialogShow = false"
  >
    <div class="flex justify-between w-full text-base font-semibold mb-2 text-nc-content-gray-emphasis items-center">
      {{ 'Do you want to expand this table ?' }}
    </div>
    <div data-testid="nc-expand-upsert-modal" class="flex flex-col">
      <div class="mb-2 nc-content-gray">
        To accommodate your pasted data, we need to
        <span v-if="cellsOverwritten && rowsUpdated" class="font-bold">
          overwrite {{ cellsOverwritten }} {{ cellsOverwritten === 1 ? 'cell' : 'cells' }} in {{ rowsUpdated }}
          {{ rowsUpdated === 1 ? 'record' : 'records' }}
        </span>
        <template v-if="newRows">
          <template v-if="cellsOverwritten || rowsUpdated"> and </template>
          <span class="font-bold"> insert {{ newRows }} additional {{ newRows === 1 ? 'record' : 'records' }} </span>
        </template>
        <template v-if="newColumns">
          <template v-if="cellsOverwritten || rowsUpdated || newRows"> and </template>
          <span class="font-bold"> insert {{ newColumns }} additional {{ newColumns === 1 ? 'field' : 'fields' }} </span>
        </template>
      </div>

      <a-radio-group v-if="(newRows ?? 0) > 0" v-model:value="expand">
        <PermissionsTooltip :entity="PermissionEntity.TABLE" :entity-id="meta?.id" :permission="PermissionKey.TABLE_RECORD_ADD">
          <a-radio
            data-testid="nc-table-expand-yes"
            :style="{
              display: 'flex',
              height: '30px',
              lineHeight: '30px',
            }"
            :value="true"
            :disabled="!isAddingEmptyRowPermitted"
          >
            <div class="nc-content-gray">
              <span class="font-semibold"> Expand </span>
              table to accommodate all pasted cells
            </div>
          </a-radio>
        </PermissionsTooltip>
        <a-radio
          data-testid="nc-table-expand-no"
          :style="{
            display: 'flex',
            lineHeight: '30px',
          }"
          :value="false"
        >
          <div class="nc-content-gray leading-5">
            <span class="font-semibold"> Don't expand </span>
            the table. Values beyond the table's current size will be skipped.
          </div>
        </a-radio>
      </a-radio-group>
    </div>
    <div class="flex flex-row mt-5 justify-end gap-x-2">
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
  </NcModal>
</template>
