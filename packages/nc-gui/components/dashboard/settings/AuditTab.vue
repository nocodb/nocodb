<script setup lang="ts">
import { Tooltip as ATooltip, Empty } from 'ant-design-vue'
import type { AuditType } from 'nocodb-sdk'
import { ProjectIdInj, h, iconMap, onMounted, storeToRefs, timeAgo, useBase, useGlobal, useI18n, useNuxtApp } from '#imports'

const { $api } = useNuxtApp()

const { base } = storeToRefs(useBase())

const _projectId = inject(ProjectIdInj, undefined)
const baseId = computed(() => _projectId.value ?? base.value?.id)

const { t } = useI18n()

const isLoading = ref(false)

const audits = ref<null | Array<AuditType>>(null)

const totalRows = ref(0)

const currentPage = ref(1)

const currentLimit = ref(25)

const { appInfo } = useGlobal()

async function loadAudits(page = currentPage.value, limit = currentLimit.value) {
  try {
    if (!base.value?.id) return

    isLoading.value = true

    const { list, pageInfo } = await $api.base.auditList(baseId.value, {
      offset: limit * (page - 1),
      limit,
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
    await loadAudits(currentPage.value, currentLimit.value)
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
    customRender: (value: { text: string }) => h('pre', {}, value.text),
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
    width: '10%',
  },
]
</script>

<template>
  <div class="flex flex-col gap-4 w-full">
    <div v-if="!appInfo.auditEnabled" class="text-red-500">Audit logs are currently disabled by administrators.</div>
    <div class="flex flex-row justify-end items-center">
      <a-button class="self-start !rounded-md" @click="loadAudits">
        <!-- Reload -->
        <div class="flex items-center gap-2 text-gray-600 font-light">
          <component :is="iconMap.reload" :class="{ 'animate-infinite animate-spin !text-success': isLoading }" />

          {{ $t('general.reload') }}
        </div>
      </a-button>
    </div>

    <a-table
      class="nc-audit-table w-full"
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
    <div class="flex flex-row justify-center items-center">
      <a-pagination
        v-model:current="currentPage"
        v-model:page-size="currentLimit"
        :total="+totalRows"
        show-less-items
        @change="loadAudits"
      />
    </div>
  </div>
</template>

<style lang="scss">
.nc-audit-table pre {
  display: table;
  table-layout: fixed;
  width: 100%;
  white-space: break-spaces;
  font-size: unset;
  font-family: unset;
}
</style>
