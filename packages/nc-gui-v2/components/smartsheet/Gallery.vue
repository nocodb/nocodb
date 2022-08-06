<script lang="ts" setup>
import { isVirtualCol } from 'nocodb-sdk'
import { inject, provide, useViewData } from '#imports'
import { ActiveViewInj, ChangePageInj, FieldsInj, IsFormInj, IsGridInj, MetaInj, PaginationDataInj, ReadonlyInj } from '~/context'
import ImageIcon from '~icons/mdi/file-image-box'

const meta = inject(MetaInj)
const view = inject(ActiveViewInj)

// todo: get from parent ( inject or use prop )
const isPublicView = false

const selected = reactive<{ row?: number | null; col?: number | null }>({})
const editEnabled = ref(false)

const { loadData, paginationData, formattedData: data, loadGalleryData, galleryData, changePage } = useViewData(meta, view as any)

provide(IsFormInj, false)
provide(IsGridInj, false)
provide(PaginationDataInj, paginationData)
provide(ChangePageInj, changePage)
provide(ReadonlyInj, true)

const fields = inject(FieldsInj, ref([]))

const coverImageColumn = $(computed(() => fields.value.find((col) => col.id === galleryData.value?.fk_cover_image_col_id)))

const coverUrl = (record: any) => {
  try {
    return JSON.parse(record.row[coverImageColumn?.title])[0].url
  } catch (e) {
    return null
  }
}

watch(
  [meta, view],
  async () => {
    if (meta?.value && view?.value) {
      await loadData()
      await loadGalleryData()
    }
  },
  { immediate: true },
)

const isRowEmpty = (record: any, col: any) => {
  const val = record.row[col.title]
  if (!val) return true

  return Array.isArray(val) && val.length === 0
}
</script>

<template>
  <div class="grid grid-cols-4 gap-x-4 gap-y-4 pt-4 overflow-y-scroll h-full px-3">
    <div v-for="(record, recordIndex) in data" :key="recordIndex" class="flex flex-col">
      <a-card hoverable class="!rounded-lg h-full">
        <template #cover>
          <img v-if="record.row[coverImageColumn?.title]" class="h-52 rounded-t-lg" :src="coverUrl(record)" />
          <ImageIcon v-else class="w-full h-48 my-4 text-cool-gray-200" />
        </template>

        <div
          v-for="(col, colIndex) in fields"
          :key="colIndex"
          class="flex flex-col space-y-1 px-4 mb-6 bg-gray-50 rounded-lg w-full"
        >
          <div class="flex flex-row w-full justify-start border-b-1 border-gray-100 py-2.5">
            <div class="w-full text-gray-600">
              <SmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="true" />
              <SmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
            </div>
          </div>

          <div class="flex flex-row w-full pb-3 pt-2 pl-2 items-center justify-start">
            <div v-if="isRowEmpty(record, col)" class="h-3 bg-gray-200 px-5 rounded-lg"></div>
            <template v-else>
              <SmartsheetVirtualCell v-if="isVirtualCol(col)" v-model="record.row[col.title]" :column="col" />
              <SmartsheetCell v-else v-model="record.row[col.title]" :column="col" :edit-enabled="false" />
            </template>
          </div>
        </div>
      </a-card>
    </div>
  </div>
</template>

<style scoped>
.nc-gallery-container {
  height: calc(100vh - 160px);
  overflow: auto;
}
</style>
