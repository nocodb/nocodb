<script lang="ts" setup>
import dayjs from 'dayjs'

const { t } = useI18n()
const authStore = useOAuthAuthorizations()
const { getPossibleAttachmentSrc } = useAttachment()
const { $api } = useNuxtApp()
const { getBaseUrl } = useGlobal()

const workspaceMap = ref<Record<string, any>>({})
const baseMap = ref<Record<string, any>>({})

const {
  sorts,
  sortDirection,
  loadSorts,
  handleGetSortedData,
  saveOrUpdate: saveOrUpdateSort,
} = useUserSorts('OAuthAuthorization')

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    if (Object.keys(value).length === 0) {
      saveOrUpdateSort({})
      return
    }

    const entries = Object.entries(value)
    if (entries.length > 0) {
      const [field, direction] = entries[0]
      saveOrUpdateSort({
        field,
        direction,
      })
    }
  },
})

const searchText = ref('')

const filteredAuthorizations = computed(() => {
  if (!searchText.value) return authStore.authorizations

  const search = searchText.value.toLowerCase()
  return authStore.authorizations.filter((auth) => {
    return auth.client_name?.toLowerCase().includes(search) || auth.client_description?.toLowerCase().includes(search)
  })
})

const sortedAuthorizations = computed(() => handleGetSortedData(filteredAuthorizations.value, sorts.value))

const isRevokeModalOpen = ref(false)
const selectedAuthorization = ref<any>(null)

const openRevokeModal = (authorization: any) => {
  selectedAuthorization.value = authorization
  isRevokeModalOpen.value = true
}

const handleRevoked = () => {
  isRevokeModalOpen.value = false
  selectedAuthorization.value = null
}

const columns = [
  {
    key: 'application',
    title: 'Application',
    name: 'Application',
    minWidth: 200,
    padding: '12px 24px',
    showOrderBy: true,
    dataIndex: 'client_name',
  },
  {
    key: 'access',
    title: 'Access',
    width: 250,
    minWidth: 250,
  },
  {
    key: 'created_at',
    title: 'Authorized',
    width: 150,
    minWidth: 150,
    showOrderBy: true,
    dataIndex: 'created_at',
  },
  {
    key: 'action',
    title: 'Actions',
    width: 80,
    minWidth: 80,
    justify: 'justify-end',
    align: 'center',
  },
] as NcTableColumnProps[]

const getFormattedDate = (date: string) => {
  if (!date) return 'Never'
  return dayjs(date).format('D MMM YYYY')
}

const getRelativeTime = (date: string) => {
  if (!date) return 'Never'
  const now = dayjs()
  const then = dayjs(date)
  const diffMonths = now.diff(then, 'month')
  const diffYears = now.diff(then, 'year')

  if (diffYears >= 2) return `within the last ${diffYears} years`
  if (diffYears === 1) return 'within the last year'
  if (diffMonths >= 7) return `within the last ${diffMonths} months`
  if (diffMonths >= 2) return `within the last ${diffMonths} months`
  return 'recently'
}

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

const loadWorkspacesAndBases = async () => {
  try {
    if (isEeUI) {
      // Load workspaces in EE
      const workspaces = await $api.workspace.list()
      workspaceMap.value = workspaces.list.reduce((acc, ws) => {
        acc[ws.id] = ws
        return acc
      }, {})

      // Load bases for each workspace in EE
      for (const ws of workspaces.list) {
        try {
          const { list } = await $api.workspaceBase.list(ws.id, {
            baseURL: getBaseUrl(ws.id),
          })

          if (list && list.length > 0) {
            list.forEach((base) => {
              baseMap.value[base.id] = base
            })
          }
        } catch (e) {
          console.error(`Failed to load bases for workspace ${ws.id}:`, e)
        }
      }
    } else {
      // Load bases in CE
      const { list } = await $api.base.list()
      if (list && list.length > 0) {
        baseMap.value = list.reduce((acc, base) => {
          acc[base.id] = base
          return acc
        }, {})
      }
    }
  } catch (e) {
    console.error('Failed to load workspaces/bases:', e)
  }
}

onMounted(async () => {
  loadSorts()
  await authStore.loadAuthorizations()
  await loadWorkspacesAndBases()
})
</script>

<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="ncSliders" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ t('title.externalIntegrations') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w p-6 flex flex-col gap-6">
      <div class="max-w-280 mx-auto w-full flex flex-col" style="height: calc(100vh - 200px)">
        <div class="flex gap-4 items-baseline justify-between">
          <h6 class="text-xl text-left text-nc-content-gray font-bold my-0" data-rec="true">
            {{ t('title.externalIntegrations') }}
          </h6>
        </div>

        <div class="text-nc-content-gray-subtle2 leading-5 mt-2">
          You have granted <span class="font-semibold">{{ authStore.authorizations.length }} applications</span> access to your
          account.
        </div>

        <div v-if="authStore.isLoading" class="flex items-center justify-center h-64">
          <GeneralLoader size="large" />
        </div>

        <div v-else-if="authStore.authorizations.length === 0" class="flex flex-col items-center justify-center h-64 gap-4">
          <GeneralIcon icon="ncSliders" class="text-nc-content-gray-subtle2 !h-16 !w-16" />
          <div class="text-center">
            <div class="text-lg font-semibold text-nc-content-gray-emphasis">No authorized applications</div>
            <div class="text-sm text-nc-content-gray-subtle mt-1">You haven't authorized any applications yet</div>
          </div>
        </div>

        <div v-else class="flex-1 overflow-hidden mt-5">
          <NcTable
            v-model:order-by="orderBy"
            :columns="columns"
            header-row-height="44px"
            row-height="64px"
            :data="sortedAuthorizations"
            class="h-full"
            body-row-class-name="nc-oauth-authorization-item group no-border-last"
          >
            <template #bodyCell="{ column, record: authorization }">
              <template v-if="column.key === 'application'">
                <div class="flex items-center gap-3">
                  <CellAttachmentPreviewImage
                    v-if="authorization.logo_uri"
                    :srcs="getPossibleAttachmentSrc(authorization.logo_uri)"
                    class="!object-contain !w-10 !h-10 !rounded-lg"
                    :is-cell-preview="false"
                  />
                  <div v-else class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span class="text-primary text-lg font-semibold">{{ authorization.client_name?.charAt(0) || 'A' }}</span>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <div class="text-nc-content-gray-extreme font-semibold text-sm truncate">
                      {{ authorization.client_name }}
                    </div>
                    <div class="text-nc-content-gray-subtle text-xs truncate">
                      <template v-if="authorization.last_used_at"> {{ getRelativeTime(authorization.last_used_at) }} · </template>
                      Owned by
                      <a
                        v-if="authorization.client_uri"
                        :href="authorization.client_uri"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary hover:underline"
                        @click.stop
                      >
                        {{ getHostname(authorization.client_uri) }}
                      </a>
                      <span v-else>{{ authorization.client_id }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <template v-if="column.key === 'access'">
                <div class="flex flex-col gap-1.5">
                  <!-- Workspace -->
                  <div
                    v-if="authorization.granted_resources?.workspace_id"
                    class="flex items-center gap-2 text-nc-content-gray-subtle text-xs"
                  >
                    <template v-if="workspaceMap[authorization.granted_resources.workspace_id]">
                      <GeneralWorkspaceIcon
                        :workspace="workspaceMap[authorization.granted_resources.workspace_id]"
                        size="small"
                        class="flex-shrink-0"
                      />
                      <NcTooltip class="truncate max-w-[150px]">
                        <template #title>
                          {{ workspaceMap[authorization.granted_resources.workspace_id].title }}
                        </template>
                        <span class="truncate">
                          {{ workspaceMap[authorization.granted_resources.workspace_id].title }}
                        </span>
                      </NcTooltip>
                    </template>
                    <template v-else>
                      <GeneralIcon icon="ncWorkspace" class="!h-3.5 !w-3.5 flex-shrink-0 text-nc-content-gray-disabled" />
                      <span class="text-nc-content-gray-disabled italic">Workspace (No access)</span>
                    </template>
                  </div>

                  <!-- Base -->
                  <div
                    v-if="authorization.granted_resources?.base_id"
                    class="flex items-center gap-2 text-nc-content-gray-subtle text-xs"
                  >
                    <template v-if="baseMap[authorization.granted_resources.base_id]">
                      <GeneralProjectIcon
                        :color="parseProp(baseMap[authorization.granted_resources.base_id]?.meta).iconColor"
                        size="small"
                        class="flex-shrink-0"
                      />
                      <NcTooltip class="truncate max-w-[150px]">
                        <template #title>
                          {{ baseMap[authorization.granted_resources.base_id].title }}
                        </template>
                        <span class="truncate">
                          {{ baseMap[authorization.granted_resources.base_id].title }}
                        </span>
                      </NcTooltip>
                    </template>
                    <template v-else>
                      <GeneralIcon icon="ncDatabase" class="!h-3.5 !w-3.5 flex-shrink-0 text-nc-content-gray-disabled" />
                      <span class="text-nc-content-gray-disabled italic">Base (No access)</span>
                    </template>
                  </div>

                  <!-- All resources -->
                  <div
                    v-if="!authorization.granted_resources?.workspace_id && !authorization.granted_resources?.base_id"
                    class="text-nc-content-gray-subtle text-xs"
                  >
                    All resources
                  </div>
                </div>
              </template>

              <template v-if="column.key === 'created_at'">
                <div class="text-nc-content-gray-subtle text-sm">
                  {{ getFormattedDate(authorization.created_at) }}
                </div>
              </template>

              <template v-if="column.key === 'action'">
                <NcDropdown>
                  <NcButton type="secondary" class="!hidden !group-hover:block" size="small" @click.stop>
                    <GeneralIcon icon="threeDotVertical" />
                  </NcButton>

                  <template #overlay>
                    <NcMenu variant="small">
                      <NcMenuItem danger @click="openRevokeModal(authorization)">
                        <GeneralIcon icon="delete" />
                        {{ t('general.revoke') }}
                      </NcMenuItem>
                    </NcMenu>
                  </template>
                </NcDropdown>
              </template>
            </template>
          </NcTable>
        </div>
      </div>
    </div>

    <DlgOAuthAuthorizationRevoke
      v-if="selectedAuthorization"
      v-model="isRevokeModalOpen"
      :authorization="selectedAuthorization"
      @revoked="handleRevoked"
    />
  </div>
</template>

<style scoped lang="scss">
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
