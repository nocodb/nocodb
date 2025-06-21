<script lang="ts" setup>
import { type BaseType } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  tableId: string
  base: BaseType
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)
</script>

<template>
  <GeneralModal
    v-model:visible="visible"
    :class="{ active: visible }"
    :mask-closable="true"
    :keyboard="true"
    :mask-style="{
      'background-color': 'rgba(0, 0, 0, 0.08)',
    }"
    wrap-class-name="nc-modal-table-permissions"
    :footer="null"
    class="!w-[30rem]"
    @keydown.esc="visible = false"
  >
    <PermissionsTable :table-id="tableId" :base="base">
      <template #actions>
        <NcButton type="text" size="small" @click="visible = false">
          <GeneralIcon icon="close" class="w-4 h-4" />
        </NcButton>
      </template>
    </PermissionsTable>
  </GeneralModal>
</template>
