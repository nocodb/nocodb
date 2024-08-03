<script setup lang="ts">
import Draggable from 'vuedraggable'
import type { SourceType } from 'nocodb-sdk'
import { ClientType } from '#imports'

interface Props {
  state: string
  baseId: string
  reload?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:state', 'update:reload'])

const vState = useVModel(props, 'state', emits)

const vReload = useVModel(props, 'reload', emits)

const { $api, $e } = useNuxtApp()

const basesStore = useBases()
const { loadProject } = basesStore
const { isDataSourceLimitReached, bases } = storeToRefs(basesStore)

const base = computed(() => bases.value.get(props.baseId) ?? {})

const { isUIAllowed } = useRoles()

const { projectPageTab } = storeToRefs(useConfigStore())

const { refreshCommandPalette } = useCommandPalette()

const sources = ref<SourceType[]>([])

const activeBaseId = ref('')

const clientType = ref<ClientType>(ClientType.MYSQL)

const isReloading = ref(false)

const isDeleteBaseModalOpen = ref(false)
const toBeDeletedBase = ref<SourceType | undefined>()

async function updateIfSourceOrderIsNullOrDuplicate() {
  const sourceOrderSet = new Set()
  let hasNullOrDuplicates = false

  // Check if sources.value contains null or duplicate order
  for (const source of sources.value) {
    if (source.order === null || sourceOrderSet.has(source.order)) {
      hasNullOrDuplicates = true
      break
    }
    sourceOrderSet.add(source.order)
  }

  if (!hasNullOrDuplicates) return

  // make sure default source is always first
  sources.value = sources.value.sort((a, b) => {
    if (a.is_local || a.is_meta) return -1
    if (b.is_local || b.is_meta) return 1
    return (a.order ?? 0) - (b.order ?? 0)
  })

  // update the local state
  sources.value = sources.value.map((source, i) => {
    return {
      ...source,
      order: i + 1,
    }
  })

  try {
    await Promise.all(
      sources.value.map(async (source) => {
        await $api.source.update(source.base_id as string, source.id as string, {
          id: source.id,
          base_id: source.base_id,
          order: source.order,
        })
      }),
    )
    await loadProject(base.value.id as string, true)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

async function loadBases(changed?: boolean) {
  try {
    if (changed) refreshCommandPalette()

    await until(() => !!base.value.id).toBeTruthy()
    isReloading.value = true
    vReload.value = true
    const baseList = await $api.source.list(base.value.id as string)
    if (baseList.list && baseList.list.length) {
      sources.value = baseList.list
    }
    await updateIfSourceOrderIsNullOrDuplicate()
  } catch (e) {
    console.error(e)
  } finally {
    vReload.value = false
    isReloading.value = false
  }
}

const baseAction = (sourceId?: string, action?: string) => {
  if (!sourceId) return
  activeBaseId.value = sourceId
  vState.value = action || ''
}

const openDeleteBase = (source: SourceType) => {
  $e('c:source:delete')
  isDeleteBaseModalOpen.value = true
  toBeDeletedBase.value = source
}

const deleteBase = async () => {
  if (!toBeDeletedBase.value) return

  try {
    await $api.source.delete(toBeDeletedBase.value.base_id as string, toBeDeletedBase.value.id as string)

    $e('a:source:delete')

    sources.value.splice(sources.value.indexOf(toBeDeletedBase.value), 1)
    await loadProject(base.value.id as string, true)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    // TODO @mertmit
    refreshCommandPalette()
  }
}
const toggleBase = async (source: SourceType, state: boolean) => {
  try {
    if (!state && sources.value.filter((src) => src.enabled).length < 2) {
      message.info('There should be at least one enabled source!')
      return
    }
    source.enabled = state
    await $api.source.update(source.base_id as string, source.id as string, {
      id: source.id,
      base_id: source.base_id,
      enabled: source.enabled,
    })
    await loadProject(base.value.id as string, true)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    refreshCommandPalette()
  }
}

const moveBase = async (e: any) => {
  try {
    if (e.oldIndex === e.newIndex) return
    // sources list is mutated so we have to get the new index and mirror it to backend
    const source = sources.value[e.newIndex]
    if (source) {
      let nextOrder: number

      // set new order value based on the new order of the items
      if (sources.value.length - 1 === e.newIndex) {
        // If moving to the end, set nextOrder greater than the maximum order in the list
        nextOrder = Math.max(...sources.value.map((item) => item?.order ?? 0)) + 1
      } else {
        nextOrder =
          (parseFloat(String(sources.value[e.newIndex - 1]?.order ?? 0)) +
            parseFloat(String(sources.value[e.newIndex + 1]?.order ?? 0))) /
          2
      }

      const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : e.oldIndex

      await $api.source.update(source.base_id as string, source.id as string, {
        id: source.id,
        base_id: source.base_id,
        order: _nextOrder,
      })
    }
    await loadProject(base.value.id as string, true)
    await loadBases()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    await refreshCommandPalette()
  }
}

watch(
  projectPageTab,
  () => {
    if (projectPageTab.value === 'data-source') {
      loadBases()
    }
  },
  {
    immediate: true,
  },
)

watch(
  () => props.reload,
  async (reload) => {
    if (reload && !isReloading.value) {
      await loadBases()
    }
  },
)

watch(
  vState,
  async (newState) => {
    if (!sources.value.length) {
      await loadBases()
    }
    switch (newState) {
      case ClientType.MYSQL:
        clientType.value = ClientType.MYSQL
        vState.value = DataSourcesSubTab.New
        break
      case ClientType.PG:
        clientType.value = ClientType.PG
        vState.value = DataSourcesSubTab.New
        break
      case ClientType.SQLITE:
        clientType.value = ClientType.SQLITE
        vState.value = DataSourcesSubTab.New
        break
      case ClientType.MSSQL:
        clientType.value = ClientType.MSSQL
        vState.value = DataSourcesSubTab.New
        break
      case ClientType.SNOWFLAKE:
        clientType.value = ClientType.SNOWFLAKE
        vState.value = DataSourcesSubTab.New
        break
      case DataSourcesSubTab.New:
        if (isDataSourceLimitReached.value) {
          vState.value = ''
        }
        break
    }
    refreshCommandPalette()
  },
  { immediate: true },
)

const isNewBaseModalOpen = computed({
  get: () => {
    return [DataSourcesSubTab.New].includes(vState.value as any)
  },
  set: (val) => {
    if (!val) {
      vState.value = ''
    }
  },
})

const activeSource = ref<SourceType>(null)
const openedTab = ref('erd')
</script>

<template>
  <div class="flex flex-col h-full" data-testid="nc-settings-datasources-tab">
    <div class="px-4 py-2 flex justify-between">
      <a-breadcrumb separator=">" class="w-full cursor-pointer font-weight-bold">
        <a-breadcrumb-item @click="activeSource = null">
          <a class="!no-underline">Data Sources</a>
        </a-breadcrumb-item>
        <a-breadcrumb-item v-if="activeSource">
          <span class="capitalize">{{ activeSource.alias || 'Default Source' }}</span>
        </a-breadcrumb-item>
      </a-breadcrumb>

      <NcButton
        v-if="!isDataSourceLimitReached && !activeSource && isUIAllowed('sourceCreate')"
        size="large"
        class="z-10 !px-2"
        type="primary"
        @click="vState = DataSourcesSubTab.New"
      >
        <div class="flex flex-row items-center w-full gap-x-1">
          <component :is="iconMap.plus" />
          <div class="flex">{{ $t('activity.newSource') }}</div>
        </div>
      </NcButton>
    </div>
    <div data-testid="nc-settings-datasources" class="flex flex-row w-full nc-data-sources-view flex-grow min-h-0">
      <template v-if="activeSource">
        <NcTabs v-model:activeKey="openedTab" class="nc-source-tab w-full">
          <a-tab-pane key="erd">
            <template #tab>
              <div class="tab" data-testid="nc-erd-tab">
                <div>{{ $t('title.erdView') }}</div>
              </div>
            </template>
            <div class="h-full pt-4">
              <LazyDashboardSettingsErd
                class="h-full overflow-auto"
                :base-id="baseId"
                :source-id="activeSource.id"
                :show-all-columns="false"
              />
            </div>
          </a-tab-pane>
          <a-tab-pane v-if="sources && activeSource === sources[0]" key="audit">
            <template #tab>
              <div class="tab" data-testid="nc-audit-tab">
                <div>{{ $t('title.auditLogs') }}</div>
              </div>
            </template>
            <div class="p-4 h-full">
              <LazyDashboardSettingsBaseAudit :source-id="activeSource.id" />
            </div>
          </a-tab-pane>
          <a-tab-pane v-if="!activeSource.is_meta && !activeSource.is_local" key="edit">
            <template #tab>
              <div class="tab" data-testid="nc-connection-tab">
                <div>{{ $t('labels.connectionDetails') }}</div>
              </div>
            </template>
            <div class="p-6 mt-4 h-full overflow-auto">
              <LazyDashboardSettingsDataSourcesEditBase
                class="w-760px pr-5"
                :source-id="activeSource.id"
                @source-updated="loadBases(true)"
                @close="activeSource = null"
              />
            </div>
          </a-tab-pane>

          <a-tab-pane key="acl">
            <template #tab>
              <div class="tab" data-testid="nc-acl-tab">
                <div>{{ $t('labels.uiAcl') }}</div>
              </div>
            </template>

            <div class="pt-4 h-full">
              <LazyDashboardSettingsUIAcl :source-id="activeSource.id" />
            </div>
          </a-tab-pane>
          <a-tab-pane v-if="!activeSource.is_meta && !activeSource.is_local" key="meta-sync">
            <template #tab>
              <div class="tab" data-testid="nc-meta-sync-tab">
                <div>{{ $t('labels.metaSync') }}</div>
              </div>
            </template>
            <div class="pt-4 h-full">
              <LazyDashboardSettingsMetadata :source-id="activeSource.id" @source-synced="loadBases(true)" />
            </div>
          </a-tab-pane>
        </NcTabs>
      </template>
      <div v-else class="flex flex-col w-full overflow-auto mt-1">
        <div
          class="ds-table overflow-y-auto nc-scrollbar-md relative"
          :style="{
            maxHeight: 'calc(100vh - 200px)',
          }"
        >
          <div class="ds-table-head sticky top-0 bg-white">
            <div class="ds-table-row !border-0">
              <div class="ds-table-col ds-table-enabled cursor-pointer">{{ $t('general.visibility') }}</div>
              <div class="ds-table-col ds-table-name">{{ $t('general.name') }}</div>
              <div class="ds-table-col ds-table-integration-name">{{ $t('general.integration')}} {{ $t('general.name') }}</div>
              <div class="ds-table-col ds-table-type">{{ $t('general.type') }}</div>
              <div class="ds-table-col ds-table-actions">{{ $t('labels.actions') }}</div>
            </div>
          </div>
          <div class="ds-table-body">
            <Draggable :list="sources" item-key="id" handle=".ds-table-handle" @end="moveBase">
              <template #header>
                <div v-if="sources[0]" class="ds-table-row border-gray-200 cursor-pointer" @click="activeSource = sources[0]">
                  <div class="ds-table-col ds-table-enabled">
                    <div class="flex items-center gap-1" @click.stop>
                      <div v-if="sources.length > 2" class="ds-table-handle" />
                      <NcTooltip>
                        <template #title>
                          <template v-if="sources[0].enabled">{{ $t('activity.hideInUI') }}</template>
                          <template v-else>{{ $t('activity.showInUI') }}</template>
                        </template>
                        <a-switch
                          :checked="sources[0].enabled ? true : false"
                          class="cursor-pointer"
                          size="small"
                          @change="toggleBase(sources[0], $event)"
                        />
                      </NcTooltip>
                    </div>
                  </div>
                  <div class="ds-table-col ds-table-name font-medium">
                    <div class="flex items-center gap-1">
                      <!-- <GeneralBaseLogo :base-type="sources[0].type" /> -->
                      {{ $t('general.default') }}
                    </div>
                  </div>

                  <div class="ds-table-col ds-table-integration-name">
                    <div class="flex items-center gap-1">-</div>
                  </div>
                  <div class="ds-table-col ds-table-type">
                    <div class="flex items-center gap-1">-</div>
                  </div>

                  <div class="ds-table-col ds-table-actions">
                    <NcButton
                      v-if="!sources[0].is_meta && !sources[0].is_local"
                      size="small"
                      class="nc-action-btn nc-edit-base cursor-pointer outline-0 !w-8 !px-1 !rounded-lg"
                      type="text"
                      @click.stop="baseAction(sources[0].id, DataSourcesSubTab.Edit)"
                    >
                      <GeneralIcon icon="edit" class="text-gray-600" />
                    </NcButton>
                  </div>
                </div>
              </template>
              <template #item="{ element: source, index }">
                <div v-if="index !== 0" class="ds-table-row border-gray-200 cursor-pointer" @click="activeSource = source">
                  <div class="ds-table-col ds-table-enabled">
                    <div class="flex items-center gap-1" @click.stop>
                      <GeneralIcon v-if="sources.length > 2" icon="dragVertical" small class="ds-table-handle" />
                      <a-tooltip>
                        <template #title>
                          <template v-if="source.enabled">{{ $t('activity.hideInUI') }}</template>
                          <template v-else>{{ $t('activity.showInUI') }}</template>
                        </template>
                        <a-switch
                          :checked="source.enabled ? true : false"
                          class="cursor-pointer"
                          size="small"
                          @change="toggleBase(source, $event)"
                        />
                      </a-tooltip>
                    </div>
                  </div>
                  <div class="ds-table-col ds-table-name font-medium w-full">
                    <div v-if="source.is_meta || source.is_local" class="h-8 w-1">-</div>
                    <span v-else class="truncate">
                      {{ source.is_meta || source.is_local ? $t('general.base') : source.alias }}
                    </span>
                  </div>
                  <div class="ds-table-col ds-table-integration-name font-medium w-full">
                    <span class="truncate">
                      {{ source?.integration_name || '-' }}
                    </span>
                  </div>

                  <div class="ds-table-col ds-table-type">
                    <div class="flex items-center gap-2">
                      <GeneralBaseLogo :source-type="source.type" />
                      <span class="text-gray-700 capitalize">{{ source.type }}</span>
                    </div>
                  </div>
                  <div class="ds-table-col justify-end gap-x-1 ds-table-actions">
                    <NcTooltip>
                      <template #title>
                        {{ $t('general.remove') }}
                      </template>
                      <NcButton
                        v-if="!source.is_meta && !source.is_local"
                        size="small"
                        class="nc-action-btn nc-delete-base cursor-pointer outline-0 !w-8 !px-1 !rounded-lg"
                        type="text"
                        @click.stop="openDeleteBase(source)"
                      >
                        <GeneralIcon icon="delete" class="text-red-500" />
                      </NcButton>
                    </NcTooltip>
                  </div>
                </div>
              </template>
            </Draggable>
          </div>
        </div>
        <LazyDashboardSettingsDataSourcesCreateBase
          v-model:open="isNewBaseModalOpen"
          :connection-type="clientType"
          @source-created="loadBases(true)"
        />
        <GeneralDeleteModal
          v-model:visible="isDeleteBaseModalOpen"
          :entity-name="$t('general.datasource')"
          :on-delete="deleteBase"
          :delete-label="$t('general.remove')"
        >
          <template #entity-preview>
            <div v-if="toBeDeletedBase" class="flex flex-row items-center py-2 px-3.25 bg-gray-50 rounded-lg text-gray-700 mb-4">
              <GeneralBaseLogo :source-type="toBeDeletedBase.type" />
              <div
                class="capitalize text-ellipsis overflow-hidden select-none w-full pl-3"
                :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
              >
                {{ toBeDeletedBase.alias }}
              </div>
            </div>
          </template>
        </GeneralDeleteModal>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ds-table{
  @apply border-1 border-gray-200 rounded-lg h-full;
}
.ds-table-head {
  @apply flex items-center border-b-1 text-gray-500 bg-gray-50 text-sm font-weight-500;
}

.ds-table-body {
  @apply flex flex-col;
}

.ds-table-row {
  @apply grid grid-cols-18 border-b border-gray-100 w-full h-full;
}

.ds-table-col {
  @apply flex items-start py-3 mr-2;
}

.ds-table-enabled {
  @apply col-span-2 flex justify-center items-center;
}

.ds-table-name {
  @apply col-span-6 items-center capitalize;
}

.ds-table-integration-name {
  @apply col-span-6 items-center capitalize;
}

.ds-table-type {
  @apply col-span-2 items-center;
}

.ds-table-actions {
  @apply col-span-2 flex w-full justify-center;
}

.ds-table-col:last-child {
  @apply border-r-0;
}

.ds-table-handle {
  @apply cursor-pointer justify-self-start mr-2 w-[16px];
}
.ds-table-body .ds-table-row:hover {
  @apply bg-gray-50/60;
}

:deep(.ant-tabs-content),
:deep(.ant-tabs) {
  @apply !h-full;
}
:deep(.ant-tabs-content-holder) {
  @apply !min-h-0 !flex-shrink;
}
</style>
