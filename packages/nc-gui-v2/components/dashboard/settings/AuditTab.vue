<script setup lang="ts">
import { Tooltip as ATooltip } from 'ant-design-vue'
import { h, ref } from 'vue'
import type { AuditType } from 'nocodb-sdk'
import { calculateDiff } from '~/helpers'

const { $api } = useNuxtApp()
const { project } = useProject()

const isLoading = ref(true)
const audits = ref<null | Array<AuditType>>(null)
const totalRows = ref(0)
const page = ref(1)
const limit = ref(25)

const loadAudits = async () => {
  try {
    isLoading.value = true
    const { list, pageInfo } = await $api.project.auditList(project.value.id ?? '', {
      offset: (limit.value * (page.value - 1)).toString(),
      limit: limit.value.toString(),
    })

    audits.value = list
    totalRows.value = pageInfo.totalRows ?? 0
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  if (audits.value === null) {
    loadAudits()
  }
})

const columns = [
  {
    title: 'Operation Type',
    dataIndex: 'op_type',
    key: 'op_type',
  },
  {
    title: 'Operation sub-type',
    dataIndex: 'op_sub_type',
    key: 'op_sub_type',
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
  },
  {
    title: 'User',
    dataIndex: 'user',
    key: 'user',
    customRender: (value: { text: string }) => h('div', value.text || 'Shared base'),
  },
  {
    title: 'Created',
    dataIndex: 'created_at',
    key: 'created_at',
    sort: 'desc',
    customRender: (value: { text: string }) =>
      h(ATooltip, { placement: 'bottom', title: h('span', {}, value.text) }, calculateDiff(value.text)),
  },
]
</script>

<template>
  <a-button class="mb-2" :loading="isLoading" @click="loadAudits"> Reload </a-button>

  <div v-if="isLoading" class="flex flex-row justify-center w-full p-32">
    <a-spin size="large" />
  </div>
  <template v-else>
    <a-table class="centre" :data-source="audits ?? []" :columns="columns" :pagination="false" />
    <a-pagination
      v-model:current="page"
      :page-size="limit"
      class="pt-4"
      :total="totalRows"
      show-less-items
      @change="loadAudits"
    />
  </template>
</template>

<style scoped></style>
