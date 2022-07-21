<script setup lang="ts">
import { Tooltip as ATooltip } from 'ant-design-vue'
import type { AuditType } from 'nocodb-sdk'
import { timeAgo } from '~/utils/dateTimeUtils'
import { h, ref, useNuxtApp, useProject } from '#imports'
import MdiReload from '~icons/mdi/reload'

interface Props {
  projectId: string
}

const { projectId } = defineProps<Props>()

const { $api } = useNuxtApp()
const { project, loadProject } = useProject()

let isLoading = $ref(false)

let audits = $ref<null | Array<AuditType>>(null)

let totalRows = $ref(0)

const currentPage = ref(1)
const currentLimit = ref(25)

async function loadAudits(page: number, limit: number) {
  try {
    if (!project.value?.id) return

    isLoading = true

    const { list, pageInfo } = await $api.project.auditList(project.value?.id, {
      offset: (limit * (page - 1)).toString(),
      limit: limit.toString(),
    })

    audits = list
    totalRows = 100
  } catch (e) {
    console.error(e)
  } finally {
    isLoading = false
  }
}

onMounted(async () => {
  if (audits === null) {
    await loadProject(projectId)
    await loadAudits(currentPage.value, currentLimit.value)
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
    customRender: (value: { text: string }) => h('div', () => value.text || 'Shared base'),
  },
  {
    title: 'Created',
    dataIndex: 'created_at',
    key: 'created_at',
    sort: 'desc',
    customRender: (value: { text: string }) =>
      h(ATooltip, { placement: 'bottom', title: h('span', {}, value.text) }, () => timeAgo(value.text)),
  },
]
</script>

<template>
  <div class="flex flex-col gap-4 w-full">
    <a-button class="self-start" @click="loadAudits">
      <div class="flex items-center gap-2">
        <MdiReload :class="{ 'animate-infinite animate-spin !text-success': isLoading }" />
        Reload
      </div>
    </a-button>

    <a-table class="w-full" :data-source="audits ?? []" :columns="columns" :pagination="false" :loading="isLoading" />

    <a-pagination
      v-model:current="currentPage"
      :page-size="currentLimit"
      :total="totalRows"
      show-less-items
      @change="loadAudits"
    />
  </div>
</template>
