<script lang="ts" setup>
import InfiniteLoading from 'v3-infinite-loading'

const emit = defineEmits(['close'])

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
</script>

<template>
  <div class="flex flex-col w-1/4 max-w-80 px-5 shadow-sm border-l-1 border-gray-100 overflow-y-auto">
    <div class="flex flex-row justify-between font-semibold text-base my-3 w-full items-center">
      <div>History</div>
      <div class="p-1 flex items-center hover:bg-gray-100 cursor-pointer rounded-md" @click="close">
        <MdiArrowLeft />
      </div>
    </div>

    <div class="flex flex-col">
      <div
        v-for="item in history"
        :key="item.id"
        class="flex flex-row py-3 px-3 my-1.5 rounded-md hover:bg-gray-100 cursor-pointer border-1"
        :class="{
          'bg-gray-100': currentHistory && currentHistory.id === item.id,
        }"
        @click="setCurrentHistory(item)"
      >
        <div>{{ item.last_page_updated_time }}</div>
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
