<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
  tableId: string
  title?: string
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const baseStore = useBase()
const { navigateToProjectPage } = baseStore
const { base } = storeToRefs(baseStore)

const onNavigateToPermissionsOverview = () => {
  navigateToProjectPage({ page: 'permissions' })
  visible.value = false
}
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
    wrap-class-name="nc-modal-single-table-permissions"
    :footer="null"
    class="!w-[30rem]"
    @keydown.esc="visible = false"
  >
    <PermissionsTable :table-id="tableId" :base="base">
      <template #title>
        <div class="flex items-center gap-2">
          <GeneralIcon icon="lock" class="w-5 h-5 flex items-center" />
          <div class="text-nc-content-gray-subtle2 font-bold">Table permissions</div>
          <div v-if="title" class="flex items-center bg-nc-bg-gray-medium px-1 gap-1 rounded-md">
            <GeneralIcon icon="table" class="w-4 h-4" />
            <div>{{ title }}</div>
          </div>
        </div>
      </template>
    </PermissionsTable>
    <div class="flex justify-end mt-6">
      <NcButton type="ghost" size="small" @click="onNavigateToPermissionsOverview">Go to Permissions Overview</NcButton>
    </div>
  </GeneralModal>
</template>
