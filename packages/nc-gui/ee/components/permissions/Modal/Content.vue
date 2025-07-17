<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import { PermissionEntity } from 'nocodb-sdk'

interface Props {
  tableId: string
  permissionsFieldWrapperClass?: string
  permissionsTableWrapperClass?: string
  permissionsTableToolbarClassName?: string
}

const props = defineProps<Props>()

const { getMeta } = useMetas()

const { base } = storeToRefs(useBase())

const tableData = ref<TableType | null>(null)
const isLoading = ref(false)

// Load table metadata
const loadTableMeta = async () => {
  if (!props.tableId) return

  isLoading.value = true
  try {
    tableData.value = await getMeta(props.tableId)
  } catch (error) {
    console.error('Failed to load table metadata:', error)
  } finally {
    isLoading.value = false
  }
}

const onRevertToDefault = (permission: PermissionEntity) => {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgResetPermissions'), {
    'visible': isOpen,
    'tableName': tableData.value?.title,
    'options': [permission],
    'tableId': props.tableId,
    'tableColumns': tableData.value?.columns || [],
    'showCheckbox': false,
    'onUpdate:visible': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}

// Watch for table ID changes
watch(
  () => props.tableId,
  (newTableId) => {
    if (!newTableId) return

    loadTableMeta()
  },
  { immediate: true },
)

defineExpose({
  loadTableMeta,
  tableData,
})
</script>

<template>
  <div class="flex-1 px-6 pb-6 nc-scrollbar-thin relative w-full h-full flex flex-col gap-8">
    <div v-if="isLoading" class="flex items-center justify-center py-8 mt-6">
      <GeneralLoader size="large" />
    </div>

    <template v-else-if="tableData">
      <PermissionsTable
        :table-id="tableId"
        :base="base"
        class="!gap-4 min-w-[540px] mx-auto w-full mt-6"
        :class="permissionsTableWrapperClass"
        placement="bottomLeft"
      >
        <template #actions="{ hasPermissions }">
          <NcButton type="secondary" size="small" :disabled="!hasPermissions" @click="onRevertToDefault(PermissionEntity.TABLE)">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="ncRotateCcw" class="flex-none h-4 w-4" />
              <span>{{ $t('activity.revertToDefault') }}</span>
            </div>
          </NcButton>
        </template>
      </PermissionsTable>

      <div class="flex min-w-[540px] mx-auto w-full" :class="permissionsFieldWrapperClass">
        <PermissionsField :table-data="tableData" :table-toolbar-class-name="permissionsTableToolbarClassName">
          <template #actions="{ hasPermissions }">
            <NcButton
              type="secondary"
              size="small"
              :disabled="!hasPermissions"
              @click="onRevertToDefault(PermissionEntity.FIELD)"
            >
              <div class="flex items-center gap-2">
                <GeneralIcon icon="ncRotateCcw" class="flex-none h-4 w-4" />
                <span>{{ $t('activity.revertToDefault') }}</span>
              </div>
            </NcButton>
          </template>
        </PermissionsField>
      </div>
    </template>
  </div>
</template>
