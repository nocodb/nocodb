<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
  tableId: string
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
    <PermissionsTable :table-id="tableId" :base="base" />
    <div class="flex justify-end mt-6">
      <NcButton type="ghost" size="small" @click="onNavigateToPermissionsOverview">Go to Permissions Overview</NcButton>
    </div>
  </GeneralModal>
</template>
