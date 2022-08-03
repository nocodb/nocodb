<script lang="ts" setup>
import { useVModel } from '@vueuse/core'
import { useLTARStoreOrThrow } from '~/composables'

const props = defineProps<{ modelValue?: boolean }>()
const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const { childrenList, loadChildrenList, childrenListPagination, relatedTablePrimaryValueProp, unlink } = useLTARStoreOrThrow()

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
      <div class="flex-1 overflow-auto min-h-0">
        <a-card v-for="(row, i) of childrenList?.list ?? []" :key="i" class="my-1 cursor-pointer" @click="unlinkRow(row)">
          {{ row[relatedTablePrimaryValueProp] }}
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
    </div>
  </a-modal>
</template>

<style scoped lang="scss">
:deep(.ant-pagination-item a) {
  line-height: 21px !important;
}
</style>
