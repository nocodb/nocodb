<script lang="ts" setup>
import { LoadingOutlined } from '@ant-design/icons-vue'

const { activeTable, baseTables } = storeToRefs(useTablesStore())

const { openedProject } = storeToRefs(useBases())

const isDataLoaded = computed(() => {
  return openedProject.value && baseTables.value.get(openedProject.value.id!)
})

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '2.5rem',
  },
  spin: true,
})
</script>

<template>
  <div class="flex flex-col p-4" style="height: calc(100vh - (var(--topbar-height) * 2))">
    <div v-if="!isDataLoaded" class="h-full w-full flex flex-col justify-center items-center">
      <a-spin size="large" :indicator="indicator" />
    </div>

    <Suspense v-else>
      <LazyErdView :table="activeTable" :source-id="activeTable?.source_id" show-all-columns />
      <template #fallback>
        <div class="h-full w-full flex flex-col justify-center items-center mt-28">
          <a-spin size="large" :indicator="indicator" />
        </div>
      </template>
    </Suspense>
  </div>
</template>
