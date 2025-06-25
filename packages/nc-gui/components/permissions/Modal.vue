<script lang="ts" setup>
import type { TableType } from 'nocodb-sdk'

interface Props {
  visible: boolean
  baseId: string
  tableId: string
}

const props = defineProps<Props>()

const emits = defineEmits(['update:visible'])

const vVisible = useVModel(props, 'visible', emits)

const { getMeta } = useMetas()

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

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
  () => {
    if (props.tableId && props.visible) {
      loadTableMeta()
    }
  },
  { immediate: true },
)

// Watch for modal visibility
watch(
  () => props.visible,
  (visible) => {
    if (visible && props.tableId) {
      loadTableMeta()
    }
  },
)
</script>

<template>
  <NcModal
    v-model:visible="vVisible"
    :header="false"
    size="large"
    :show-separator="false"
    wrap-class-name="nc-modal-field-permissions"
  >
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div class="px-4 py-3 w-full flex items-center gap-3 border-b-1 border-gray-200">
        <div class="flex items-center">
          <GeneralIcon icon="ncLock" class="!text-green-700 !h-5 !w-5" />
        </div>
        <div class="flex-1 text-base font-weight-700">Permissions for {{ tableData?.title }}</div>

        <div class="flex items-center gap-3">
          <NcButton size="small" type="text" @click="vVisible = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-hidden p-6">
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <GeneralLoader size="large" />
        </div>

        <div v-else-if="tableData" class="space-y-6 h-full flex flex-col">
          <PermissionsTable :table-id="tableId" :base="base">
            <template #actions>
              <!-- <NcButton type="text" size="small">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="ncRepeat" class="flex-none h-4 w-4" />
                  <span>Revert to Default</span>
                </div>
              </NcButton> -->
            </template>
          </PermissionsTable>

          <PermissionsField :table-data="tableData">
            <template #actions>
              <!-- <NcButton type="text" size="small">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="ncRepeat" class="flex-none h-4 w-4" />
                  <span>Revert to Default</span>
                </div>
              </NcButton> -->
            </template>
          </PermissionsField>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-field-permissions {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }
}
</style>
