<script setup lang="ts">
import { Tooltip as ATooltip, Empty } from 'ant-design-vue'
import type { AuditType } from 'nocodb-sdk'
import { h, onMounted, timeAgo, useI18n, useNuxtApp, useProject } from '#imports'

const { $api } = useNuxtApp()

const { project } = useProject()

const { t } = useI18n()

let isLoading = $ref(false)

let audits = $ref<null | Array<AuditType>>(null)

let totalRows = $ref(0)

const currentPage = $ref(1)
const currentLimit = $ref(25)

async function loadAudits(page = currentPage, limit = currentLimit) {
  try {
    if (!project.value?.id) return

    isLoading = true

    const { list, pageInfo } = await $api.project.auditList(project.value?.id, {
      offset: (limit * (page - 1)).toString(),
      limit: limit.toString(),
    })

    audits = list
    totalRows = pageInfo.totalRows ?? 0
  } catch (e) {
    console.error(e)
  } finally {
    isLoading = false
  }
}

onMounted(async () => {
  if (audits === null) {
    await loadAudits(currentPage, currentLimit)
  }
})

const tableHeaderRenderer = (label: string) => () => h('div', { class: 'text-gray-500' }, label)

const columns = [
  {
    // Operation Type
    title: tableHeaderRenderer(t('labels.operationType')),
    dataIndex: 'op_type',
    key: 'op_type',
  },
  {
    // Operation sub-type
    title: tableHeaderRenderer(t('labels.operationSubType')),
    dataIndex: 'op_sub_type',
    key: 'op_sub_type',
  },
  {
    // Description
    title: tableHeaderRenderer(t('labels.description')),
    dataIndex: 'description',
    key: 'description',
  },
  {
    // User
    title: tableHeaderRenderer(t('objects.user')),
    dataIndex: 'user',
    key: 'user',
    customRender: (value: { text: string }) => h('div', {}, value.text || 'Shared base'),
  },
  {
    // Created
    title: tableHeaderRenderer(t('labels.created')),
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
    <div class="flex flex-row justify-between items-center">
      <a-button class="self-start" @click="loadAudits">
        <!--        Reload -->
        <div class="flex items-center gap-2 text-gray-600 font-light">
          <MdiReload :class="{ 'animate-infinite animate-spin !text-success': isLoading }" />

          {{ $t('general.reload') }}
        </div>
      </a-button>

      <a-pagination
        v-model:current="currentPage"
        :page-size="currentLimit"
        :total="totalRows"
        show-less-items
        @change="loadAudits"
      />
    </div>

    <a-table
      class="w-full"
      size="small"
      :data-source="audits ?? []"
      :columns="columns"
      :pagination="false"
      :loading="isLoading"
      data-testid="audit-tab-table"
    >
      <template #emptyText>
        <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
      </template>
    </a-table>
  </div>
</template>
