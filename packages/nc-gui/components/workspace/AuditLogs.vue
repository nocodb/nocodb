<script setup lang="ts">
import { Tooltip as ATooltip, Empty } from 'ant-design-vue'
import type { AuditType, WorkspaceUserType } from 'nocodb-sdk'
import { timeAgo } from 'nocodb-sdk'

interface Props {
  workspaceId?: string
}

const props = defineProps<Props>()

const { workspaceRoles } = useRoles()

const workspaceStore = useWorkspace()

const { removeCollaborator, updateCollaborator: _updateCollaborator, loadWorkspace } = workspaceStore

const { collaborators, activeWorkspace, workspacesList } = storeToRefs(workspaceStore)

const collaboratorsMap = computed<Map<string, WorkspaceUserType & { id: string }>>(() => {
  const map = new Map<string, WorkspaceUserType & { id: string }>()
  collaborators.value?.forEach((coll) => {
    if (coll?.email) {
      map.set(coll.email, coll)
    }
  })
  return map
})

const basesStore = useBases()

const { bases, basesList } = storeToRefs(basesStore)

const { $api } = useNuxtApp()

const { t } = useI18n()

const isLoading = ref(false)

const audits = ref<null | Array<AuditType>>(null)

const totalRows = ref(0)

const currentPage = ref(1)

const currentLimit = ref(25)

const isRowExpanded = ref(false)

const selectedAudit = ref<null | AuditType>(null)

const { appInfo } = useGlobal()

watchEffect(() => {
  console.log('bases', bases.value, collaborators.value, collaboratorsMap.value)
})

async function loadAudits(page = currentPage.value, limit = currentLimit.value) {
  try {
    if (!props.workspaceId) return

    isLoading.value = true

    if (limit * (page - 1) > totalRows.value) {
      currentPage.value = 1
      page = 1
    }

    const { list, pageInfo } = await $api.workspace.auditList(props.workspaceId, {
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

const handleRowClick = (audit: AuditType) => {
  selectedAudit.value = audit
  isRowExpanded.value = true
}

onMounted(async () => {
  if (audits.value === null) {
    await loadAudits(currentPage.value, currentLimit.value)
  }
})
</script>

<template>
  <div class="h-full flex flex-col gap-4 w-full h-[calc(100vh-120px)] pt-6">
    <div v-if="!appInfo.auditEnabled" class="text-red-500">Audit logs are currently disabled by administrators.</div>
    <div class="flex flex-col gap-y-6">
      <div class="flex flex-col gap-3">
        <div class="flex flex-row items-center gap-3">
          <h6 class="text-xl font-semibold text-gray-900 !my-0">Audit Logs</h6>
          <NcButton class="!px-1" type="text" size="xs" :disabled="isLoading" @click="loadAudits">
            <!-- Reload -->
            <div class="flex items-center text-gray-600 font-light">
              <component :is="iconMap.refresh" :class="{ 'animate-infinite animate-spin': isLoading }" />
            </div>
          </NcButton>
        </div>
        <div class="text-sm text-gray-600">Track and monitor any changes made to any base in your workspace.</div>
      </div>
      <div></div>
    </div>
    <div class="h-[calc(100%_-_102px)] relative">
      <div class="table-wrapper h-[calc(100%_-_40px)] overflow-auto nc-scrollbar-thin">
        <div class="nc-audit-logs-table table h-full">
          <div class="thead sticky top-0">
            <div class="tr">
              <div class="th cell-user">User</div>
              <div class="th cell-timestamp">Time stamp</div>
              <div class="th cell-base">Base</div>
              <div class="th cell-type">Type</div>
              <div class="th cell-sub-type">Sub-type</div>
              <div class="th cell-description">Description</div>
              <div class="th cell-ip">IP</div>
            </div>
          </div>
          <div class="tbody">
            <div
              v-show="isLoading"
              class="flex items-center justify-center absolute l-0 t-0 w-full h-full z-10 pb-10 pointer-events-none"
            >
              <div class="flex flex-col justify-center items-center gap-2">
                <GeneralLoader size="xlarge" />
                <span class="text-center">Loading...</span>
              </div>
            </div>
            <template v-if="audits?.length">
              <template v-for="(audit, i) of audits" :key="i">
                <div
                  class="tr"
                  @click="handleRowClick(audit)"
                  :class="{
                    selected: selectedAudit?.id === audit.id && isRowExpanded,
                  }"
                >
                  <div class="td cell-user">
                    <div v-if="collaboratorsMap.get(audit.user)?.email" class="w-full flex gap-3 items-center">
                      <GeneralUserIcon :email="collaboratorsMap.get(audit.user)?.email" size="base" class="flex-none" />
                      <div class="flex-1 flex flex-col max-w-[calc(100%_-_44px)]">
                        <div class="w-full flex gap-3">
                          <span class="text-sm text-gray-800 capitalize font-semibold truncate">
                            {{
                              collaboratorsMap.get(audit.user)?.display_name ||
                              collaboratorsMap
                                .get(audit.user)
                                ?.email?.slice(0, collaboratorsMap.get(audit.user)?.email.indexOf('@'))
                            }}
                            some of the things that i wanted to ask
                          </span>
                        </div>
                        <span class="text-xs text-gray-600 truncate">
                          {{ collaboratorsMap.get(audit.user)?.email }}
                        </span>
                      </div>
                    </div>
                    <template v-else>{{ audit.user }} </template>
                  </div>
                  <div class="td cell-timestamp">
                    <NcTooltip placement="bottom">
                      <template #title> {{ parseStringDateTime(audit.created_at, 'D MMMM YYYY HH:mm') }}</template>

                      {{ timeAgo(audit.created_at) }}
                    </NcTooltip>
                  </div>
                  <div class="td cell-base">
                    <div v-if="audit.base_id" class="w-full">
                      <div class="truncate text-sm text-gray-800 font-semibold">
                        {{ bases.get(audit.base_id)?.title }}
                      </div>
                      <div class="text-gray-600 text-xs">ID: {{ audit.base_id }}</div>
                    </div>
                    <template v-else>
                      {{ audit.base_id }}
                    </template>
                  </div>
                  <div class="td cell-type">{{ audit.op_type }}</div>
                  <div class="td cell-sub-type">{{ audit.op_sub_type }}</div>
                  <div class="td cell-description">
                    <div class="truncate">
                      {{ audit.description }}
                    </div>
                  </div>
                  <div class="td cell-ip">
                    <div class="truncate">
                      {{ audit.ip }}
                    </div>
                  </div>
                </div>
              </template>
            </template>
            <div v-else-if="!isLoading" class="flex items-center justify-center text-gray-500">
              <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="+totalRows > currentLimit"
        class="flex flex-row justify-center items-center bg-gray-50 min-h-10"
        :class="{
          'pointer-events-none': isLoading,
        }"
      >
        <div class="flex justify-between items-center w-full px-6">
          <div>&nbsp;</div>
          <NcPagination
            v-model:current="currentPage"
            v-model:page-size="currentLimit"
            :total="+totalRows"
            show-size-changer
            :use-stored-page-size="false"
            @update:current="loadAudits"
            @update:page-size="loadAudits(currentPage, $event)"
          />
          <div class="text-gray-500 text-xs">{{ totalRows }} records</div>
        </div>
      </div>
    </div>
    <NcModal v-model:visible="isRowExpanded" size="medium" :show-separator="false" @keydown.esc="isRowExpanded = false">
      <template #header>
        <div class="flex items-center justify-between gap-x-2 w-full">
          <div class="flex-1 text-base font-weight-700 text-gray-900">Audit Details</div>
          <div class="flex items-center gap-2">
            <span class="cell-header"> Time stamp </span>
            <span class="text-gray-600 text-small leading-[18px]">{{
              parseStringDateTime(selectedAudit.created_at, 'D MMMM YYYY HH:mm')
            }}</span>
          </div>
        </div>
      </template>
      <div class="flex flex-col gap-4" v-if="selectedAudit">
        <div class="bg-gray-50 rounded-lg border-1 border-gray-200 flex">
          <div class="w-1/2 border-r border-gray-200 flex flex-col gap-2 px-4 py-3">
            <div class="cell-header">Performed by</div>
            <div
              v-if="selectedAudit?.user && collaboratorsMap.get(selectedAudit.user)?.email"
              class="w-full flex gap-3 items-center"
            >
              <GeneralUserIcon :email="collaboratorsMap.get(selectedAudit.user)?.email" size="base" class="flex-none" />
              <div class="flex-1 flex flex-col">
                <div class="w-full flex gap-3">
                  <span class="text-sm text-gray-800 capitalize font-semibold">
                    {{
                      collaboratorsMap.get(selectedAudit.user)?.display_name ||
                      collaboratorsMap
                        .get(selectedAudit.user)
                        ?.email?.slice(0, collaboratorsMap.get(selectedAudit.user)?.email.indexOf('@'))
                    }}
                  </span>
                </div>
                <span class="text-xs text-gray-600">
                  {{ collaboratorsMap.get(selectedAudit.user)?.email }}
                </span>
              </div>
            </div>

            <div v-else class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.user }}</div>
          </div>
          <div class="w-1/2 flex flex-col gap-2 px-4 py-3">
            <div class="cell-header">IP Address</div>
            <div class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.ip }}</div>
          </div>
        </div>
        <div class="bg-gray-50 rounded-lg border-1 border-gray-200 flex">
          <div class="w-1/2 border-r border-gray-200 flex flex-col gap-2 px-4 py-3">
            <div class="cell-header">Base</div>
            <div v-if="selectedAudit?.base_id && bases.get(selectedAudit?.base_id)" class="flex items-stretch gap-3">
              <div class="flex items-center">
                <GeneralProjectIcon
                  :color="bases.get(selectedAudit?.base_id)?.meta?.iconColor"
                  :type="bases.get(selectedAudit?.base_id)?.type || 'database'"
                  class="nc-view-icon w-5 h-5"
                />
              </div>
              <div>
                <div class="text-sm">{{ bases.get(selectedAudit?.base_id)?.title }}</div>
                <div class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.base_id }}</div>
              </div>
            </div>
            <template v-else>
              {{ selectedAudit.base_id }}
            </template>
          </div>
          <div class="w-1/2">
            <div class="h-1/2 border-b border-gray-200 flex items-center gap-2 px-4 py-3">
              <div class="cell-header">Type</div>
              <div class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.op_type }}</div>
            </div>
            <div class="h-1/2 flex items-center gap-2 px-4 py-3">
              <div class="cell-header">Sub-type</div>
              <div class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.op_sub_type }}</div>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <div class="cell-header">{{ $t('labels.description') }}</div>
          <div class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.description }}</div>
        </div>
      </div>
    </NcModal>
  </div>
</template>

<style lang="scss" scoped>
.nc-audit-table pre {
  display: table;
  table-layout: fixed;
  width: 100%;
  white-space: break-spaces;
  font-size: unset;
  font-family: unset;
}

.nc-audit-logs-table {
  .thead {
    .th {
      @apply bg-gray-50 text-sm text-gray-600;
    }
  }

  .tbody {
    .td {
      @apply text-small leading-[18px] text-gray-600;
    }
  }

  .tr {
    @apply h-[54px] flex overflow-hidden border-b-1  border-gray-200 cursor-pointer;

    &:hover .td {
      @apply bg-gray-50;
    }

    &.selected .td {
      @apply bg-gray-50;
    }

    .th,
    .td {
      @apply px-6 h-full flex items-center;

      &.cell-user {
        @apply w-[220px];
      }

      &.cell-timestamp,
      &.cell-base,
      &.cell-ip {
        @apply w-[180px];
      }
      &.cell-type {
        @apply w-[118px];
      }
      &.cell-sub-type {
        @apply w-[150px];
      }
      &.cell-description {
        @apply w-[472px];
      }
    }
  }
}

.cell-header {
  @apply uppercase text-tiny font-semibold text-gray-500;
}
</style>
