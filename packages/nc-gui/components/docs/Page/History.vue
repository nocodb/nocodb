<script lang="ts" setup>
const emit = defineEmits(['close'])

const { history } = storeToRefs(useDocHistoryStore())
const { setCurrentHistory } = useDocHistoryStore()

const close = () => {
  setCurrentHistory(null)
  emit('close')
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
        @click="setCurrentHistory(item)"
      >
        <div>{{ item.updated_at }}</div>
      </div>
    </div>
  </div>
</template>
