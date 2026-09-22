<script setup lang="ts">
import Draggable from 'vuedraggable'
import { PlanLimitTypes, type SourceType } from 'nocodb-sdk'
import { ClientType, DataSourcesSubTab } from '#imports'

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

const { isUIAllowed, environmentRestrictionReason } = useRoles()

const sourceCreateReason = computed(() => (!isDataSourceLimitReached.value ? environmentRestrictionReason('sourceCreate') : null))

const { projectPageTab } = storeToRefs(useConfigStore())

const { refreshCommandPalette } = useCommandPalette()

const { updateStatLimit, showExternalSourcePlanLimitExceededModal } = useEeConfig()

const sources = ref<SourceType[]>([])

const clientType = ref<ClientType>(ClientType.MYSQL)

const isReloading = ref(false)

const isDeleteBaseModalOpen = ref(false)
const toBeDeletedBase = ref<SourceType | undefined>()

const searchQuery = ref<string>('')

const normalizedSearchQuery = computed(() => (searchQuery.value ?? '').toLowerCase())

// The base's own source, wherever it sits in the list — it is drawn as the pinned
// "Default" row. -1 when the base has none, i.e. it was connected straight to an
// external database and every source it has is a real one.
const defaultSourceIndex = computed(() => baseOwnSourceIndex(sources.value))

const defaultSource = computed(() => (defaultSourceIndex.value === -1 ? null : sources.value[defaultSourceIndex.value]))

// `alias` is null on the default source and on legacy rows, and `null?.includes()`
// answers undefined — which reads as "no match" and hides the row for every query,
// the empty one included.
const matchesSearchQuery = (source?: SourceType | null) =>
  (source?.alias ?? '').toLowerCase().includes(normalizedSearchQuery.value)

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

  // make sure default source is always first. Compare against the one source we picked
  // as the base's own — testing each side with the predicate makes the comparator
  // inconsistent once two sources match it, and the order written back is persisted.
  const ownSourceId = baseOwnSourceId(sources.value)

  sources.value = [...sources.value].sort((a, b) => {
    if (a.id === ownSourceId) return -1
    if (b.id === ownSourceId) return 1
    return (a.order ?? 0) - (b.order ?? 0)
  })

  let initialOrder = 1

  if (sources.value[0]?.id !== ownSourceId) {
    // If default source not found, and only one source, return
    if (sources.value.length === 1) return

    // If default source not found and more than one source, set initial order to 2
    // because order 1 is for default source
    initialOrder = 2
  }

  // update the local state
  sources.value = sources.value.map((source) => {
    return {
      ...source,
      order: initialOrder++,
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
      // Normalised here too: this is the one place that reads the API rather
      // than the store, and `moveBase` maps Draggable's DOM-child index onto
      // this array — an alignment that only holds with the default source first.
      sources.value = withDefaultSourceFirst(baseList.list)
    }
    await updateIfSourceOrderIsNullOrDuplicate()
  } catch (e) {
    console.error(e)
  } finally {
    vReload.value = false
    isReloading.value = false
  }
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
    updateStatLimit(PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE, -1)
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
    if (searchQuery.value) {
      searchQuery.value = ''
    }

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
      case ClientType.SNOWFLAKE:
        clientType.value = ClientType.SNOWFLAKE
        vState.value = DataSourcesSubTab.New
        break
      case DataSourcesSubTab.New:
        if (showExternalSourcePlanLimitExceededModal() || isDataSourceLimitReached.value) {
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

const activeSource = ref<SourceType | null>(null)
const openedTab = ref('erd')

const isSearchResultAvailable = () => {
  return (
    sources.value.some((source) => source.id !== defaultSource.value?.id && matchesSearchQuery(source)) ||
    (!!defaultSource.value && 'default'.includes(normalizedSearchQuery.value))
  )
}

const isOpenModal = computed({
  get: () => !!activeSource.value,
  set: (value) => {
    if (!value) {
      activeSource.value = null
    }
  },
})

const handleClickRow = (source: SourceType, tab?: string) => {
  if (tab && tab !== openedTab.value) {
    openedTab.value = tab
  }

  activeSource.value = source
}
</script>

<template>
  <!-- pt-3 rather than p-6: lines the search box up with the sidebar's own search. -->
  <div class="flex flex-col h-full px-6 pb-6 pt-3" data-testid="nc-settings-datasources-tab">
    <div class="mb-6 flex items-center justify-between gap-3">
      <a-input
        v-model:value="searchQuery"
        type="text"
        class="nc-search-data-source-input nc-input-border-on-value !max-w-90 nc-input-sm"
        :placeholder="$t('placeholder.searchDataSource')"
        allow-clear
      >
        <template #prefix>
          <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
        </template>
      </a-input>

      <ShellActions>
        <NcTooltip
          v-if="(!isDataSourceLimitReached && isUIAllowed('sourceCreate')) || !!sourceCreateReason"
          :title="sourceCreateReason ? $t(sourceCreateReason) : ''"
          :disabled="!sourceCreateReason"
        >
          <NcButton
            size="small"
            class="z-10 !px-2"
            type="primary"
            :disabled="!!sourceCreateReason"
            @click="
              () => {
                if (sourceCreateReason) return
                if (showExternalSourcePlanLimitExceededModal()) return
                vState = DataSourcesSubTab.New
              }
            "
          >
            <div class="flex flex-row items-center w-full gap-x-1">
              <GeneralIcon icon="plus" />
              <span>{{ $t('activity.newSource') }}</span>
            </div>
          </NcButton>
        </NcTooltip>
      </ShellActions>
    </div>
    <div data-testid="nc-settings-datasources" class="flex flex-row w-full nc-data-sources-view flex-1 min-h-0">
      <NcModal
        v-model:visible="isOpenModal"
        centered
        size="large"
        wrap-class-name="nc-active-data-sources-view"
        @keydown.esc="activeSource = null"
      >
        <div v-if="activeSource" class="h-full">
          <div class="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
            <a-breadcrumb separator=">" class="flex-1 cursor-pointer font-weight-bold !ml-1">
              <a-breadcrumb-item @click="activeSource = null">
                <a class="!no-underline text-base">{{ $t('labels.dataSources') }}</a>
              </a-breadcrumb-item>
              <a-breadcrumb-item v-if="activeSource">
                <span class="capitalize text-base">{{ activeSource.alias || 'Default Source' }}</span>
              </a-breadcrumb-item>
            </a-breadcrumb>

            <NcButton size="small" type="text" class="nc-close-btn" @click="isOpenModal = false">
              <GeneralIcon icon="close" class="text-nc-content-gray-subtle2" />
            </NcButton>
          </div>

          <NcTabs v-model:active-key="openedTab" class="nc-source-tab w-full h-[calc(100%_-_58px)] max-h-[calc(100%_-_58px)]">
            <a-tab-pane v-if="!activeSource.is_meta && !activeSource.is_local" key="edit">
              <template #tab>
                <div class="tab" data-testid="nc-connection-tab">
                  <div>{{ $t('labels.connectionDetails') }}</div>
                </div>
              </template>
              <div class="h-full">
                <LazyDashboardSettingsDataSourcesEditBase
                  :source-id="activeSource.id"
                  @source-updated="loadBases(true)"
                  @close="activeSource = null"
                />
              </div>
            </a-tab-pane>
            <a-tab-pane key="erd">
              <template #tab>
                <div class="tab" data-testid="nc-erd-tab">
                  <div>{{ $t('title.erdView') }}</div>
                </div>
              </template>
              <div class="h-full p-6">
                <LazyDashboardSettingsErd
                  class="h-full overflow-auto"
                  :base-id="base.id"
                  :source-id="activeSource.id"
                  :show-all-columns="false"
                />
              </div>
            </a-tab-pane>

            <a-tab-pane key="acl">
              <template #tab>
                <div class="tab" data-testid="nc-acl-tab">
                  <div>{{ $t('labels.viewHide') }}</div>
                </div>
              </template>

              <div class="p-6 h-full">
                <LazyDashboardSettingsUIAcl :source-id="activeSource.id" />
              </div>
            </a-tab-pane>
            <a-tab-pane v-if="!activeSource.is_meta && !activeSource.is_local" key="meta-sync">
              <template #tab>
                <div class="tab" data-testid="nc-meta-sync-tab">
                  <div>{{ $t('labels.metaSync') }}</div>
                </div>
              </template>
              <div class="p-6 h-full">
                <DashboardSettingsMetadata :source-id="activeSource.id" @source-synced="loadBases(true)" />
              </div>
            </a-tab-pane>
          </NcTabs>
        </div>
      </NcModal>
      <div class="flex flex-col w-full min-h-0">
        <template v-if="isNewBaseModalOpen">
          <DashboardSettingsDataSourcesCreateBase
            v-model:open="isNewBaseModalOpen"
            :connection-type="clientType"
            is-modal
            @source-created="loadBases(true)"
          />
        </template>
        <div v-else class="ds-table overflow-y-auto nc-scrollbar-thin relative">
          <div class="ds-table-head sticky top-0 z-10">
            <div class="ds-table-row">
              <div class="ds-table-col ds-table-enabled">{{ $t('general.visibility') }}</div>
              <div class="ds-table-col ds-table-name">{{ $t('general.name') }}</div>
              <div class="ds-table-col ds-table-integration-name">{{ $t('general.connection') }} {{ $t('general.name') }}</div>
              <div class="ds-table-col ds-table-type">{{ $t('general.type') }}</div>
              <div class="ds-table-col ds-table-actions" />
            </div>
          </div>
          <div class="ds-table-body relative">
            <Draggable
              v-bind="getDraggableAutoScrollOptions({ scrollSensitivity: 56 })"
              :list="sources"
              item-key="id"
              handle=".ds-table-handle"
              @end="moveBase"
            >
              <template v-if="defaultSource && 'default'.includes(normalizedSearchQuery)" #header>
                <div v-if="defaultSource" class="ds-table-row cursor-pointer" @click="handleClickRow(defaultSource, 'erd')">
                  <div class="ds-table-col ds-table-enabled">
                    <div class="flex items-center gap-1" @click.stop>
                      <div v-if="sources.length > 2" class="ds-table-handle" />
                      <NcTooltip>
                        <template #title>
                          <template v-if="defaultSource.enabled">{{ $t('activity.hideInUI') }}</template>
                          <template v-else>{{ $t('activity.showInUI') }}</template>
                        </template>
                        <a-switch
                          :checked="defaultSource.enabled ? true : false"
                          class="cursor-pointer"
                          size="small"
                          @change="toggleBase(defaultSource, $event)"
                        />
                      </NcTooltip>
                    </div>
                  </div>
                  <div class="ds-table-col ds-table-name">
                    <span class="truncate">{{ $t('general.default') }}</span>
                  </div>
                  <div class="ds-table-col ds-table-integration-name">-</div>
                  <div class="ds-table-col ds-table-type">-</div>
                  <div class="ds-table-col ds-table-actions" @click.stop>
                    <div class="flex justify-end">
                      <NcDropdown placement="bottomRight">
                        <NcButton size="small" type="secondary">
                          <GeneralIcon icon="threeDotVertical" />
                        </NcButton>
                        <template #overlay>
                          <NcMenu variant="small">
                            <NcMenuItemCopyId
                              :id="defaultSource.id"
                              :tooltip="$t('labels.clickToCopySourceID')"
                              :label="
                                $t('labels.sourceIdColon', {
                                  sourceId: defaultSource.id,
                                })
                              "
                            />
                          </NcMenu>
                        </template>
                      </NcDropdown>
                    </div>
                  </div>
                </div>
              </template>
              <template #item="{ element: source, index }">
                <div
                  v-if="index !== defaultSourceIndex"
                  class="ds-table-row cursor-pointer"
                  :class="{
                    '!hidden': !matchesSearchQuery(source),
                  }"
                  @click="handleClickRow(source, 'edit')"
                >
                  <div class="ds-table-col ds-table-enabled">
                    <div class="flex items-center gap-1" @click.stop>
                      <GeneralIcon v-if="sources.length > 2" icon="dragVertical" small class="ds-table-handle" />
                      <NcTooltip>
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
                      </NcTooltip>
                    </div>
                  </div>
                  <div class="ds-table-col ds-table-name">
                    <span v-if="source.is_meta || source.is_local">-</span>
                    <NcTooltip v-else class="truncate" show-on-truncate-only>
                      <template #title>{{ source.alias }}</template>
                      {{ source.alias }}
                    </NcTooltip>
                  </div>
                  <div class="ds-table-col ds-table-integration-name">
                    <NcTooltip class="truncate" show-on-truncate-only>
                      <template #title>
                        {{ source?.integration_title || '-' }}
                      </template>
                      {{ source?.integration_title || '-' }}
                    </NcTooltip>
                  </div>

                  <div class="ds-table-col ds-table-type">
                    <NcBadge rounded="lg" class="flex items-center gap-2 px-0 py-1 !h-7 truncate !border-transparent">
                      <GeneralBaseLogo :source-type="source.type" class="flex-none !w-4 !h-4" />
                      <NcTooltip placement="bottom" show-on-truncate-only class="text-sm truncate">
                        <template #title> {{ clientTypesMap[source.type]?.text || source.type }}</template>

                        {{ source.type && clientTypesMap[source.type] ? clientTypesMap[source.type]?.text : source.type }}
                      </NcTooltip>
                    </NcBadge>
                  </div>
                  <div class="ds-table-col ds-table-actions" @click.stop>
                    <div class="flex justify-end">
                      <NcDropdown placement="bottomRight">
                        <NcButton size="small" type="secondary">
                          <GeneralIcon icon="threeDotVertical" />
                        </NcButton>
                        <template #overlay>
                          <NcMenu variant="small">
                            <NcMenuItemCopyId
                              :id="source.id"
                              :tooltip="$t('labels.clickToCopySourceID')"
                              :label="
                                $t('labels.sourceIdColon', {
                                  sourceId: source.id,
                                })
                              "
                            />

                            <template v-if="!source.is_meta && !source.is_local">
                              <NcDivider />

                              <NcMenuItem @click="handleClickRow(source, 'edit')">
                                <GeneralIcon icon="edit" />
                                <span>{{ $t('general.edit') }}</span>
                              </NcMenuItem>

                              <NcDivider />
                              <NcMenuItem danger @click.stop="openDeleteBase(source)">
                                <GeneralIcon icon="delete" />
                                {{ $t('general.remove') }}
                              </NcMenuItem>
                            </template>
                          </NcMenu>
                        </template>
                      </NcDropdown>
                    </div>
                  </div>
                </div>
              </template>
            </Draggable>

            <ShellEmpty
              v-if="!isReloading && sources?.length && !isSearchResultAvailable()"
              :title="$t('title.noResultsMatchedYourSearch')"
            />
          </div>
          <div
            v-show="isReloading"
            class="flex items-center justify-center absolute left-0 top-[54px] w-full h-[calc(100%_-_54px)] z-10 pointer-events-none"
          >
            <div class="flex flex-col justify-center items-center gap-2">
              <a-spin size="large" />
              <span class="text-center">{{ $t('general.loading') }}</span>
            </div>
          </div>
        </div>

        <GeneralDeleteModal
          v-model:visible="isDeleteBaseModalOpen"
          :entity-name="$t('general.datasource')"
          :on-delete="deleteBase"
          :delete-label="$t('general.remove')"
        >
          <template #entity-preview>
            <div
              v-if="toBeDeletedBase"
              class="flex flex-row items-center py-2 px-3.25 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle mb-4"
            >
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
/* Mirrors NcTable (bordered card, 54px rows); kept as a div grid so rows stay draggable. */
.ds-table {
  @apply h-full border-1 border-nc-border-gray-medium rounded-lg overflow-hidden;
}

.ds-table-head {
  @apply bg-nc-bg-gray-extralight text-sm text-nc-content-gray-muted font-weight-500;
}

.ds-table-body {
  @apply flex flex-col;

  .ds-table-col {
    @apply text-sm text-nc-content-gray-subtle2;
  }

  .ds-table-name {
    @apply text-captionBold text-nc-content-gray;
  }

  .ds-table-row:hover {
    @apply bg-nc-bg-gray-extralight;
  }

  .ds-table-row:last-child {
    @apply border-b-0;
  }
}

.ds-table-row {
  @apply grid grid-cols-18 w-full h-[54px] border-b-1 border-nc-border-gray-medium;
}

.ds-table-col {
  @apply flex items-center min-w-0 px-6;
}

.ds-table-enabled {
  @apply col-span-2;
}

.ds-table-name {
  @apply col-span-6;
}

.ds-table-integration-name {
  @apply col-span-5;
}

.ds-table-type {
  @apply col-span-3;
}

.ds-table-actions {
  @apply col-span-2 justify-end;
}

.ds-table-handle {
  @apply cursor-pointer flex-none mr-2 w-4;
}

:deep(.ant-tabs-content),
:deep(.ant-tabs) {
  @apply !h-full;
}
:deep(.ant-tabs-content-holder) {
  @apply !min-h-0 !flex-shrink;
}
</style>

<style lang="scss">
.nc-active-data-sources-view {
  .ant-modal-content {
    @apply overflow-hidden;
  }
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }
  .ant-tabs-nav {
    @apply pl-3;
  }
}
</style>
