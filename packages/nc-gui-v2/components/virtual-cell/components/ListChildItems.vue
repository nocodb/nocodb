<script lang="ts" setup>
import { useVModel } from '@vueuse/core'
import { useLTARStoreOrThrow } from '~/composables'
import MdiReloadIcon from '~icons/mdi/reload'
import MdiDeleteIcon from '~icons/mdi/delete-outline'
import MdiUnlinkIcon from '~icons/mdi/link-variant-remove'

const props = defineProps<{ modelValue?: boolean }>()
const emit = defineEmits(['update:modelValue', 'attachRecord'])

const vModel = useVModel(props, 'modelValue', emit)

const {
  childrenList,
  meta,
  deleteRelatedRow,
  loadChildrenList,
  childrenListPagination,
  relatedTablePrimaryValueProp,
  unlink,
  getRelatedTableRowId,
} = useLTARStoreOrThrow()

watch(vModel, () => {
  if (vModel.value) {
    loadChildrenList()
  }
})

const unlinkRow = async (row: Record<string, any>) => {
  await unlink(row)
  await loadChildrenList()
}
</script>

<template>
  <a-modal v-model:visible="vModel" :footer="null" title="Child list">
    <div class="max-h-[max(calc(100vh_-_300px)_,500px)] flex flex-col">
      <div class="flex mb-4 align-center gap-2">
        <!-- <a-input v-model:value="childrenListPagination.query" class="max-w-[200px]" size="small"></a-input> -->
        <div class="flex-1" />
        <MdiReloadIcon class="cursor-pointer text-gray-500" @click="loadChildrenList" />
        <a-button type="primary" size="small" @click="emit('attachRecord')">
          <div class="flex align-center gap-1">
            <MdiUnlinkIcon class="text-xs text-white" @click="unlinkRow(row)" />
            Link to '{{ meta.title }}'
          </div>
        </a-button>
      </div>
      <template v-if="childrenList?.pageInfo?.totalRows">
        <div class="flex-1 overflow-auto min-h-0">
          <a-card v-for="(row, i) of childrenList?.list ?? []" :key="i" class="ma-2 hover:(!bg-gray-200/50 shadow-md)">
            <div class="flex align-center">
              <div class="flex-grow overflow-hidden min-w-0">
                {{ row[relatedTablePrimaryValueProp]
                }}<span class="text-gray-400 text-[11px] ml-1">(Primary key : {{ getRelatedTableRowId(row) }})</span>
              </div>
              <div class="flex-1"></div>
              <div class="flex gap-2">
                <MdiUnlinkIcon class="text-xs text-grey hover:(!text-red-500) cursor-pointer" @click="unlinkRow(row)" />
                <MdiDeleteIcon class="text-xs text-grey hover:(!text-red-500) cursor-pointer" @click="deleteRelatedRow(row)" />
              </div>
            </div>
          </a-card>
        </div>
        <a-pagination
          v-if="childrenList?.pageInfo"
          v-model:current="childrenListPagination.page"
          v-model:page-size="childrenListPagination.size"
          class="mt-2 mx-auto"
          size="small"
          :total="childrenList.pageInfo.totalRows"
          show-less-items
        />
      </template>
      <a-empty v-else class="my-10" />
    </div>
  </a-modal>
</template>

<style scoped lang="scss">
:deep(.ant-pagination-item a) {
  line-height: 21px !important;
}
</style>
