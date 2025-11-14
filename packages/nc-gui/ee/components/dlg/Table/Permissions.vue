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

const { activeTables } = storeToRefs(useTablesStore())

const onNavigateToPermissionsOverview = () => {
  navigateToProjectPage({ page: 'permissions', action: `permissions-${props.tableId}` })
  visible.value = false
}

const table = computed(() => activeTables.value.find((table) => table.id === props.tableId))
</script>

<template>
  <NcModal
    v-model:visible="visible"
    size="xs"
    height="auto"
    :show-separator="false"
    wrap-class-name="nc-modal-single-table-permissions"
  >
    <PermissionsTable :table="table" :table-id="tableId" :base="base" horizontal>
      <template #title>
        <div class="flex-1 flex items-center gap-2 text-nc-content-gray-emphasis">
          <GeneralIcon icon="ncLock" class="w-5 h-5 flex-none" />
          <div class="text-subHeading2">{{ $t('title.tablePermissions') }}</div>
          <div
            v-if="title"
            class="flex items-center bg-nc-bg-gray-medium px-1 gap-1 rounded-md text-caption text-nc-content-gray-subtle"
          >
            <GeneralIcon icon="table" class="w-4 h-4 flex-none" />
            <div>{{ title }}</div>
          </div>
        </div>
      </template>
    </PermissionsTable>
    <div class="flex justify-start mt-5">
      <NcButton type="secondary" size="small" @click="onNavigateToPermissionsOverview">
        {{ $t('title.editFieldPermissions') }}
      </NcButton>
    </div>
  </NcModal>
</template>
