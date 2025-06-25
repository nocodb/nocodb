<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'

interface Props {
  tableId: string
  permissionsFieldWrapperClass?: string
  permissionsTableWrapperClass?: string
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
  <div class="flex-1 p-6 nc-scrollbar-thin relative w-full h-full flex flex-col gap-8">
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <GeneralLoader size="large" />
    </div>

    <template v-else-if="tableData">
      <PermissionsTable
        :table-id="tableId"
        :base="base"
        class="!gap-4 min-w-[540px] mx-auto w-full"
        :class="permissionsTableWrapperClass"
        placement="bottomLeft"
      >
        <template #actions>
          <!-- <NcButton type="secondary" size="small">
                        <div class="flex items-center gap-2">
                            <GeneralIcon icon="ncRotateCcw" class="flex-none h-4 w-4" />
                            <span>Revert to Default</span>
                        </div>
                    </NcButton> -->
        </template>
      </PermissionsTable>

      <div class="flex h-full sticky top-6 min-w-[540px] mx-auto w-full" :class="permissionsFieldWrapperClass">
        <PermissionsField :table-data="tableData">
          <template #actions>
            <!-- <NcButton type="secondary" size="small">
                        <div class="flex items-center gap-2">
                          <GeneralIcon icon="ncRotateCcw" class="flex-none h-4 w-4" />
                          <span>Revert to Default</span>
                        </div>
                      </NcButton> -->
          </template>
        </PermissionsField>
      </div>
    </template>
  </div>
</template>
