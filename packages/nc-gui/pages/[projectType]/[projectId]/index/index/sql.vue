<script lang="ts" setup>
import type { Ref } from 'vue'
import type { SelectProps } from 'ant-design-vue'
import { useNuxtApp, useProject, useUIPermission } from '#imports'

const { bases } = useProject()

const { isUIAllowed } = useUIPermission()

const { $e } = useNuxtApp()

const sqlPrompt = ref('')

const rawSql = ref('')

const selectedBase = ref(bases.value[0]?.id)

const baseOptions = computed((): SelectProps['options'] => bases.value.map((b) => ({ label: b.alias || 'Default', value: b.id })))

const data: Ref<Record<string, any>[]> = ref([])

const columns: Ref<any[]> = ref([])

const handleResizeColumn = (w: number, col: any) => {
  col.width = w
}

watch(
  () => Object.keys(data.value[0] || {}),
  (keys) => {
    if (!data.value.length) {
      columns.value = []
      return
    }
    for (const key of keys) {
      if (!columns.value.find((c) => c.dataIndex === key)) {
        columns.value.push({
          title: key,
          dataIndex: key,
          resizable: true,
        })
      }
    }
    columns.value = columns.value.filter((c) => keys.includes(c.dataIndex))
  },
  { immediate: true },
)
</script>

<template>
  <div class="h-full w-full text-gray-600">
    <div>
      <div class="flex w-full items-center p-4">
        <PhSparkleFill class="mr-2 text-orange-400" />
        <a-input v-model:value="sqlPrompt" :bordered="false" placeholder="Enter your plain prompt here" />
      </div>
      <div class="h-full w-full">
        <LazyMonacoEditor v-model="rawSql" class="w-full h-[300px]" lang="sql" :hide-minimap="true" />
      </div>
      <div class="flex p-4">
        <a-select v-model:value="selectedBase" :options="baseOptions" class="w-[200px] !mr-4" />
        <a-button type="primary">
          <template #icon><MdiPlay /></template>
          Run
        </a-button>
      </div>
    </div>
    <div class="h-full bg-slate-50 p-4">
      <a-table
        :data-source="data"
        :columns="columns"
        bordered
        :pagination="{ pageSize: 25 }"
        @resize-column="handleResizeColumn"
      />
    </div>
  </div>
</template>
