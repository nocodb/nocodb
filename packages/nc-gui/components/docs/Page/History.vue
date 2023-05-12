<script lang="ts" setup>
import InfiniteLoading from 'v3-infinite-loading'
import type { DocsPageSnapshotType } from 'nocodb-sdk'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

const emit = defineEmits(['close'])

dayjs.extend(utc)

const { $api } = useNuxtApp()
const { project } = storeToRefs(useProject())
const { openedPage } = storeToRefs(useDocStore())
const { history, currentHistory } = storeToRefs(useDocHistoryStore())
const { setCurrentHistory, setHistory } = useDocHistoryStore()

const close = () => {
  setCurrentHistory(null)
  emit('close')
}

const pageNumber = ref(0)

onMounted(async () => {
  const response = await $api.nocoDocs.listPageHistory(project.value!.id!, openedPage.value!.id!, {
    pageNumber: 0,
    pageSize: 10,
  })

  setHistory(response.snapshots!)
})

const loadListData = async ($state: any) => {
  $state.loading()
  pageNumber.value += 1
  const response = await $api.nocoDocs.listPageHistory(project.value!.id!, openedPage.value!.id!, {
    pageNumber: pageNumber.value,
    pageSize: 10,
  })

  if (response.snapshots?.length === 0) {
    $state.complete()
    return
  }

  setHistory([...history.value, ...response.snapshots!])
  $state.loaded()
}

const snapshotTypeLabel = (snapshot: DocsPageSnapshotType) => {
  if (snapshot.type === 'content_update' || snapshot.type === 'title_update') {
    return 'Edited'
  } else if (snapshot.type === 'published') {
    return 'Published'
  } else if (snapshot.type === 'unpublished') {
    return 'Unpublished'
  } else if (snapshot.type === 'restored') {
    return 'Restored'
  }
}
</script>

<template>
  <div class="history-pane flex flex-col w-1/4 max-w-80 px-5 shadow-sm border-l-1 border-gray-100">
    <div class="flex flex-row justify-between font-semibold text-base my-3 ml-1 w-full items-center select-none">
      <div>History</div>
      <div class="p-1 flex items-center hover:bg-gray-100 cursor-pointer rounded-md" @click="close">
        <MdiArrowLeft />
      </div>
    </div>

    <div class="flex flex-col">
      <div
        v-for="item in history"
        :key="item.id"
        class="flex flex-row py-3 px-3 my-1.5 rounded-md hover:bg-gray-100 cursor-pointer border-1 select-none"
        :class="{
          'bg-gray-200': currentHistory && currentHistory.id === item.id,
        }"
        @click="setCurrentHistory(item)"
      >
        <div>{{ snapshotTypeLabel(item) }} {{ dayjs.utc(item.last_page_updated_time).fromNow() }}</div>
      </div>
      <InfiniteLoading v-bind="$attrs" @infinite="loadListData">
        <template #spinner>
          <div class="flex flex-row w-full justify-center mt-2">
            <a-spin />
          </div>
        </template>
        <template #complete>
          <span></span>
        </template>
      </InfiniteLoading>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.history-pane {
  overflow-y: overlay;
  // scrollbar reduce width and gray color
  &::-webkit-scrollbar {
    width: 6px !important;
  }

  /* Track */
  &::-webkit-scrollbar-track {
    background: #ffffff !important;
  }

  /* Handle */
  &::-webkit-scrollbar-thumb {
    background: #c4c4c4;
  }

  /* Handle on hover */
  &::-webkit-scrollbar-thumb:hover {
    background: #9e9e9e;
  }
}
</style>
