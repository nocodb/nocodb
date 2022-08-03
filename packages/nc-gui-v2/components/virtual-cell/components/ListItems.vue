<script lang="ts" setup>
import { watchEffect } from '@vue/runtime-core'
import { useVModel } from '@vueuse/core'
import { useLTARStoreOrThrow } from '~/composables'
import MdiReloadIcon from '~icons/mdi/reload'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const { childrenExcludedList, loadChildrenExcludedList, childrenExcludedListPagination, relatedTablePrimaryValueProp, link } =
  useLTARStoreOrThrow()

watch(vModel, () => {
  if (vModel.value) {
    loadChildrenExcludedList()
  }
})

const linkRow = async (row: Record<string, any>) => {
  await link(row)
  vModel.value= false
  // await loadChildrenExcludedList()
}
</script>

<template>
  <a-modal v-model:visible="vModel" :footer="null" title="Related table rows">
    <div class="max-h-[max(calc(100vh_-_300px)_,500px)] flex flex-col">
      <div class="flex mb-4 align-center gap-2">
        <a-input v-model:value="childrenExcludedListPagination.query" placeholder="Filter query" class="max-w-[200px]" size="small"></a-input>
        <div class="flex-1" />
        <MdiReloadIcon class="cursor-pointer text-gray-500" @click="loadChildrenExcludedList" />
        <a-button type="primary" size="small" @click="emit('addNewRecord')">Add new record</a-button>
      </div>
      <template v-if="childrenExcludedList?.pageInfo?.totalRows">
        <div class="flex-1 overflow-auto min-h-0">
          <a-card
            v-for="(row, i) in childrenExcludedList?.list ?? []"
            :key="i"
            class="ma-2 cursor-pointer hover:(!bg-gray-200/50 shadow-md)"
            @click="linkRow(row)"
          >
            {{ row[relatedTablePrimaryValueProp] }}
          </a-card>
        </div>
        <a-pagination
          v-if="childrenExcludedList?.pageInfo"
          v-model:current="childrenExcludedListPagination.page"
          v-model:page-size="childrenExcludedListPagination.size"
          class="mt-2 mx-auto !text-xs"
          size="small"
          :total="childrenExcludedList.pageInfo.totalRows"
          show-less-items
        />
      </template>
      <a-empty class="my-10" v-else />
    </div>
  </a-modal>
</template>

<style scoped>
:deep(.ant-pagination-item a) {
  line-height: 21px !important;
}
</style>
