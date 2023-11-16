<script setup lang="ts">
import Draggable from 'vuedraggable'
import type { SourceType } from 'nocodb-sdk'
import { ClientType, DataSourcesSubTab, storeToRefs, useBase, useCommandPalette, useNuxtApp } from '#imports'

interface Props {
  state: string
  reload?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:state', 'update:reload', 'awaken'])

const vState = useVModel(props, 'state', emits)

const vReload = useVModel(props, 'reload', emits)

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { loadProject } = useBases()

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const { projectPageTab } = storeToRefs(useConfigStore())

const { refreshCommandPalette } = useCommandPalette()

const sources = ref<SourceType[]>([])

const activeBaseId = ref('')

const clientType = ref<ClientType>(ClientType.MYSQL)

const isReloading = ref(false)

const forceAwakened = ref(false)

const dataSourcesAwakened = ref(false)

const isDeleteBaseModalOpen = ref(false)
const toBeDeletedBase = ref<SourceType | undefined>()

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
const toggleBase = async (source: BaseType, state: boolean) => {
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
      if (!source.order) {
        // empty update call to reorder sources (migration)
        await $api.source.update(source.base_id as string, source.id as string, {
          id: source.id,
          base_id: source.base_id,
        })
        message.info(t('info.basesMigrated'))
      } else {
        await $api.source.update(source.base_id as string, source.id as string, {
          id: source.id,
          base_id: source.base_id,
          order: e.newIndex + 1,
        })
      }
    }
    await loadProject(base.value.id as string, true)
    await loadBases()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    await refreshCommandPalette()
  }
}

const forceAwaken = () => {
  forceAwakened.value = !forceAwakened.value
  dataSourcesAwakened.value = forceAwakened.value
  emits('awaken', forceAwakened.value)
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
  () => sources.value.length,
  (l) => {
    if (l > 1 && !forceAwakened.value) {
      dataSourcesAwakened.value = false
      emits('awaken', false)
    } else {
      dataSourcesAwakened.value = true
      emits('awaken', true)
    }
  },
  { immediate: true },
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
        if (sources.value.length > 1 && !forceAwakened.value) {
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

const isErdModalOpen = computed({
  get: () => {
    return [DataSourcesSubTab.ERD].includes(vState.value as any)
  },
  set: (val) => {
    if (!val) {
      vState.value = ''
    }
  },
})

const isMetaDataModal = computed({
  get: () => {
    return [DataSourcesSubTab.Metadata].includes(vState.value as any)
  },
  set: (val) => {
    if (!val) {
      vState.value = ''
    }
  },
})

const isUIAclModalOpen = computed({
  get: () => {
    return [DataSourcesSubTab.UIAcl].includes(vState.value as any)
  },
  set: (val) => {
    if (!val) {
      vState.value = ''
    }
  },
})
const isBaseAuditModalOpen = computed({
  get: () => {
    return [DataSourcesSubTab.Audit].includes(vState.value as any)
  },
  set: (val) => {
    if (!val) {
      vState.value = ''
    }
  },
})

const isEditBaseModalOpen = computed({
  get: () => {
    return [DataSourcesSubTab.Edit].includes(vState.value as any)
  },
  set: (val) => {
    if (!val) {
      vState.value = ''
    }
  },
})
</script>

<template>
  <div class="flex flex-row w-full h-full nc-data-sources-view">
    <div class="flex flex-col w-full overflow-auto">
      <div class="flex flex-row w-full justify-end mt-6 mb-5">
        <NcButton
          v-if="dataSourcesAwakened"
          size="large"
          class="z-10 !rounded-lg !px-2 mr-2.5"
          type="primary"
          @click="vState = DataSourcesSubTab.New"
        >
          <div class="flex flex-row items-center w-full gap-x-1">
            <component :is="iconMap.plus" />
            <div class="flex">{{ $t('activity.newSource') }}</div>
          </div>
        </NcButton>
      </div>
      <div
        class="overflow-y-auto nc-scrollbar-md"
        :style="{
          maxHeight: 'calc(100vh - 200px)',
        }"
      >
        <div class="ds-table-head">
          <div class="ds-table-row">
            <div class="ds-table-col ds-table-enabled cursor-pointer" @dblclick="forceAwaken">{{ $t('general.visibility') }}</div>
            <div class="ds-table-col ds-table-name">{{ $t('general.name') }}</div>
            <div class="ds-table-col ds-table-type">{{ $t('general.type') }}</div>
            <div class="ds-table-col ds-table-actions -ml-13">{{ $t('labels.actions') }}</div>
            <div class="ds-table-col ds-table-crud"></div>
          </div>
        </div>
        <div class="ds-table-body">
          <Draggable :list="sources" item-key="id" handle=".ds-table-handle" @end="moveBase">
            <template #header>
              <div v-if="sources[0]" class="ds-table-row border-gray-200">
                <div class="ds-table-col ds-table-enabled">
                  <div class="flex items-center gap-1 cursor-pointer">
                    <a-tooltip>
                      <template #title>
                        <template v-if="sources[0].enabled">{{ $t('activity.hideInUI') }}</template>
                        <template v-else>{{ $t('activity.showInUI') }}</template>
                      </template>
                      <a-switch
                        :checked="sources[0].enabled ? true : false"
                        size="default"
                        @change="toggleBase(sources[0], $event)"
                      />
                    </a-tooltip>
                  </div>
                </div>
                <div class="ds-table-col ds-table-name font-medium">
                  <div class="flex items-center gap-1">
                    <!-- <GeneralBaseLogo :base-type="sources[0].type" /> -->
                    {{ $t('general.default') }}
                  </div>
                </div>

                <div class="ds-table-col ds-table-type">
                  <div class="flex items-center gap-1">-</div>
                </div>

                <div class="ds-table-col ds-table-actions">
                  <div class="flex items-center gap-2">
                    <NcTooltip v-if="!sources[0].is_meta && !sources[0].is_local">
                      <template #title>
                        {{ $t('tooltip.metaSync') }}
                      </template>
                      <NcButton
                        class="nc-action-btn cursor-pointer outline-0"
                        type="text"
                        data-testid="nc-data-sources-view-meta-sync"
                        size="small"
                        @click="baseAction(sources[0].id, DataSourcesSubTab.Metadata)"
                      >
                        <div class="flex items-center gap-2 text-gray-600">
                          <GeneralIcon icon="sync" class="group-hover:text-accent" />
                        </div>
                      </NcButton>
                    </NcTooltip>
                    <NcTooltip>
                      <template #title>
                        {{ $t('title.relations') }}
                      </template>
                      <NcButton
                        size="small"
                        class="nc-action-btn cursor-pointer outline-0"
                        type="text"
                        data-testid="nc-data-sources-view-erd"
                        @click="baseAction(sources[0].id, DataSourcesSubTab.ERD)"
                      >
                        <div class="flex items-center gap-2 text-gray-600">
                          <GeneralIcon icon="erd" class="group-hover:text-accent" />
                        </div>
                      </NcButton>
                    </NcTooltip>
                    <NcTooltip>
                      <template #title>
                        {{ $t('labels.uiAcl') }}
                      </template>
                      <NcButton
                        size="small"
                        class="nc-action-btn cursor-pointer outline-0"
                        type="text"
                        data-testid="nc-data-sources-view-ui-acl"
                        @click="baseAction(sources[0].id, DataSourcesSubTab.UIAcl)"
                      >
                        <div class="flex items-center gap-2 text-gray-600">
                          <GeneralIcon icon="acl" class="group-hover:text-accent" />
                        </div>
                      </NcButton>
                    </NcTooltip>
                    <NcTooltip>
                      <template #title>
                        {{ $t('title.audit') }}
                      </template>
                      <NcButton
                        size="small"
                        class="nc-action-btn cursor-pointer outline-0"
                        type="text"
                        data-testid="nc-data-sources-view-audit"
                        @click="baseAction(sources[0].id, DataSourcesSubTab.Audit)"
                      >
                        <div class="flex items-center gap-2 text-gray-600">
                          <GeneralIcon icon="book" class="group-hover:text-accent" />
                        </div>
                      </NcButton>
                    </NcTooltip>
                  </div>
                </div>
                <div class="ds-table-col ds-table-crud">
                  <NcButton
                    v-if="!sources[0].is_meta && !sources[0].is_local"
                    size="small"
                    class="nc-action-btn cursor-pointer outline-0 !w-8 !px-1 !rounded-lg"
                    type="text"
                    @click="baseAction(sources[0].id, DataSourcesSubTab.Edit)"
                  >
                    <GeneralIcon icon="edit" class="text-gray-600" />
                  </NcButton>
                </div>
              </div>
            </template>
            <template #item="{ element: source, index }">
              <div v-if="index !== 0" class="ds-table-row border-gray-200">
                <div class="ds-table-col ds-table-enabled">
                  <div class="flex items-center gap-1 cursor-pointer">
                    <a-tooltip>
                      <template #title>
                        <template v-if="source.enabled">{{ $t('activity.hideInUI') }}</template>
                        <template v-else>{{ $t('activity.showInUI') }}</template>
                      </template>
                      <a-switch :checked="source.enabled ? true : false" @change="toggleBase(source, $event)" />
                    </a-tooltip>
                  </div>
                </div>
                <div class="ds-table-col ds-table-name font-medium w-full">
                  <GeneralIcon v-if="sources.length > 2" icon="dragVertical" small class="ds-table-handle" />
                  <div v-if="source.is_meta || source.is_local">-</div>
                  <span v-else class="truncate">
                    {{ source.is_meta || source.is_local ? $t('general.base') : source.alias }}
                  </span>
                </div>

                <div class="ds-table-col ds-table-type">
                  <GeneralIcon v-if="sources.length > 2" icon="dragVertical" small class="ds-table-handle" />
                  <div class="flex items-center gap-2">
                    <GeneralBaseLogo :source-type="source.type" />
                    <span class="text-gray-700 capitalize">{{ source.type }}</span>
                  </div>
                </div>

                <div class="ds-table-col ds-table-actions">
                  <div class="flex items-center gap-2">
                    <NcTooltip>
                      <template #title>
                        {{ $t('title.relations') }}
                      </template>
                      <NcButton
                        size="small"
                        class="nc-action-btn cursor-pointer outline-0"
                        type="text"
                        data-testid="nc-data-sources-view-erd"
                        @click="baseAction(source.id, DataSourcesSubTab.ERD)"
                      >
                        <div class="flex items-center gap-2 text-gray-600">
                          <GeneralIcon icon="erd" class="group-hover:text-accent" />
                        </div>
                      </NcButton>
                    </NcTooltip>
                    <NcTooltip>
                      <template #title>
                        {{ $t('labels.uiAcl') }}
                      </template>
                      <NcButton
                        size="small"
                        type="text"
                        class="nc-action-btn cursor-pointer outline-0"
                        data-testid="nc-data-sources-view-ui-acl"
                        @click="baseAction(source.id, DataSourcesSubTab.UIAcl)"
                      >
                        <div class="flex items-center gap-2 text-gray-600">
                          <GeneralIcon icon="acl" class="group-hover:text-accent" />
                        </div>
                      </NcButton>
                    </NcTooltip>
                    <NcTooltip>
                      <template #title>
                        {{ $t('tooltip.metaSync') }}
                      </template>
                      <NcButton
                        v-if="!source.is_meta && !source.is_local"
                        size="small"
                        type="text"
                        data-testid="nc-data-sources-view-meta-sync"
                        class="nc-action-btn cursor-pointer outline-0"
                        @click="baseAction(source.id, DataSourcesSubTab.Metadata)"
                      >
                        <div class="flex items-center gap-2 text-gray-600">
                          <GeneralIcon icon="sync" class="group-hover:text-accent" />
                        </div>
                      </NcButton>
                    </NcTooltip>
                  </div>
                </div>
                <div class="ds-table-col ds-table-crud justify-end gap-x-1">
                  <NcTooltip>
                    <template #title>
                      {{ $t('general.edit') }}
                    </template>
                    <NcButton
                      v-if="!source.is_meta && !source.is_local"
                      size="small"
                      class="nc-action-btn cursor-pointer outline-0 !w-8 !px-1 !rounded-lg"
                      type="text"
                      @click="baseAction(source.id, DataSourcesSubTab.Edit)"
                    >
                      <GeneralIcon icon="edit" class="text-gray-600" />
                    </NcButton>
                  </NcTooltip>
                  <NcTooltip>
                    <template #title>
                      {{ $t('general.remove') }}
                    </template>
                    <NcButton
                      v-if="!source.is_meta && !source.is_local"
                      size="small"
                      class="nc-action-btn cursor-pointer outline-0 !w-8 !px-1 !rounded-lg"
                      type="text"
                      @click="openDeleteBase(source)"
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
      <GeneralModal v-model:visible="isErdModalOpen" size="large">
        <div class="h-[80vh]">
          <LazyDashboardSettingsErd :source-id="activeBaseId" :show-all-columns="false" />
        </div>
      </GeneralModal>
      <GeneralModal v-model:visible="isMetaDataModal" size="medium">
        <div class="p-6">
          <LazyDashboardSettingsMetadata :source-id="activeBaseId" @source-synced="loadBases(true)" />
        </div>
      </GeneralModal>
      <GeneralModal v-model:visible="isUIAclModalOpen" class="!w-[60rem]">
        <div class="p-6">
          <LazyDashboardSettingsUIAcl :source-id="activeBaseId" />
        </div>
      </GeneralModal>
      <GeneralModal v-model:visible="isEditBaseModalOpen" closable :mask-closable="false" size="medium">
        <div class="p-6">
          <LazyDashboardSettingsDataSourcesEditBase
            :source-id="activeBaseId"
            @source-updated="loadBases(true)"
            @close="isEditBaseModalOpen = false"
          />
        </div>
      </GeneralModal>
      <GeneralModal v-model:visible="isBaseAuditModalOpen" class="!w-[70rem]">
        <div class="p-6">
          <LazyDashboardSettingsBaseAudit :source-id="activeBaseId" @close="isBaseAuditModalOpen = false" />
        </div>
      </GeneralModal>
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
</template>

<style>
.ds-table-head {
  @apply flex items-center border-0 text-gray-500;
}

.ds-table-body {
  @apply flex flex-col;
}

.ds-table-row {
  @apply grid grid-cols-20 border-b border-gray-100 w-full h-full;
}

.ds-table-col {
  @apply flex items-start py-3 mr-2;
}

.ds-table-enabled {
  @apply col-span-2 flex justify-center items-center;
}

.ds-table-name {
  @apply col-span-9 items-center capitalize;
}

.ds-table-type {
  @apply col-span-2 items-center;
}

.ds-table-actions {
  @apply col-span-5 flex w-full justify-end;
}

.ds-table-crud {
  @apply col-span-2;
}

.ds-table-col:last-child {
  @apply border-r-0;
}

.ds-table-handle {
  @apply cursor-pointer justify-self-start mr-2;
}
</style>
