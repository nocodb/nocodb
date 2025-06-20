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
  [() => props.tableId, () => props.visible],
  ([newTableId, newVisible]) => {
    if (newTableId && newVisible) {
      loadTableMeta()
    }
  },
  { immediate: true },
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
      <div class="p-2 w-full flex items-center gap-3 border-b-1 border-nc-border-gray-medium">
        <div class="flex items-center">
          <GeneralIcon icon="table" class="!h-6 !w-6 pl-1" />
        </div>
        <div class="flex-1 text-lg font-bold text-nc-content-gray-emphasis">{{ tableData?.title }}</div>

        <div class="flex items-center gap-3">
          <NcButton size="small" type="text" @click="vVisible = false">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>

      <div class="h-[calc(100%_-_50px)] flex">
        <!-- Content -->
        <div class="flex-1 p-6 nc-scrollbar-thin relative">
          <div class="w-full max-w-[720px] min-w-[540px] mx-auto h-full">
            <div v-if="isLoading" class="flex items-center justify-center py-8">
              <GeneralLoader size="large" />
            </div>

            <div v-else-if="tableData" class="h-full flex flex-col">
              <PermissionsTable :table-id="tableId" :base="base" class="!gap-4 mb-8" placement="bottomLeft">
                <template #actions>
                  <!-- <NcButton type="secondary" size="small">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="ncRotateCcw" class="flex-none h-4 w-4" />
                      <span>Revert to Default</span>
                    </div>
                  </NcButton> -->
                </template>
              </PermissionsTable>
              <div class="h-[calc(100%_+_32px)] sticky top-0">
                <div class="flex h-full max-h-[calc(100%_-_32px)]">
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
              </div>
            </div>
          </div>
        </div>
        <div class="w-[320px] h-full p-5 bg-nc-bg-gray-extralight">
          <PermissionsSupportedDocs />
          <NcDivider class="!my-4" />
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
