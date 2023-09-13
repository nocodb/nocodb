<script setup lang="ts">
import Draggable from 'vuedraggable'
import type { BaseType } from 'nocodb-sdk'
import CreateBase from './data-sources/CreateBase.vue'
import EditBase from './data-sources/EditBase.vue'
import Metadata from './Metadata.vue'
import UIAcl from './UIAcl.vue'
import Erd from './Erd.vue'
import BaseAudit from './BaseAudit.vue'
import { ClientType, DataSourcesSubTab, storeToRefs, useCommandPalette, useNuxtApp, useProject } from '#imports'

interface Props {
  state: string
  reload?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:state', 'update:reload', 'awaken'])

const vState = useVModel(props, 'state', emits)

const vReload = useVModel(props, 'reload', emits)

const { $api, $e } = useNuxtApp()

const { loadProject } = useProjects()

const projectStore = useProject()
const { project } = storeToRefs(projectStore)

const { refreshCommandPalette } = useCommandPalette()

const sources = ref<BaseType[]>([])

const activeBaseId = ref('')

const metadiffbases = ref<string[]>([])

const clientType = ref<ClientType>(ClientType.MYSQL)

const isReloading = ref(false)

const forceAwakened = ref(false)

const dataSourcesAwakened = ref(false)

const isDeleteBaseModalOpen = ref(false)
const toBeDeletedBase = ref<BaseType | undefined>()

async function loadBases(changed?: boolean) {
  try {
    if (changed) refreshCommandPalette()

    await until(() => !!project.value.id).toBeTruthy()
    isReloading.value = true
    vReload.value = true
    const baseList = await $api.base.list(project.value.id as string)
    if (baseList.list && baseList.list.length) {
      sources.value = baseList.list
    }

    await loadMetaDiff()
  } catch (e) {
    console.error(e)
  } finally {
    vReload.value = false
    isReloading.value = false
  }
}

async function loadMetaDiff() {
  try {
    metadiffbases.value = []

    const metadiff = await $api.project.metaDiffGet(project.value.id as string)
    for (const model of metadiff) {
      if (model.detectedChanges?.length > 0) {
        metadiffbases.value.push(model.base_id)
      }
    }
  } catch (e) {
    console.error(e)
  }
}

const baseAction = (baseId?: string, action?: string) => {
  if (!baseId) return
  activeBaseId.value = baseId
  vState.value = action || ''
}

const openDeleteBase = (base: BaseType) => {
  $e('c:base:delete')
  isDeleteBaseModalOpen.value = true
  toBeDeletedBase.value = base
}

const deleteBase = async () => {
  if (!toBeDeletedBase.value) return

  try {
    await $api.base.delete(toBeDeletedBase.value.project_id as string, toBeDeletedBase.value.id as string)

    $e('a:base:delete')

    sources.value.splice(sources.value.indexOf(toBeDeletedBase.value), 1)
    await loadProject(project.value.id as string, true)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const toggleBase = async (base: BaseType, state: boolean) => {
  try {
    if (!state && sources.value.filter((src) => src.enabled).length < 2) {
      message.info('There should be at least one enabled base!')
      return
    }
    base.enabled = state
    await $api.base.update(base.project_id as string, base.id as string, {
      id: base.id,
      project_id: base.project_id,
      enabled: base.enabled,
    })
    await loadProject(project.value.id as string, true)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const moveBase = async (e: any) => {
  try {
    if (e.oldIndex === e.newIndex) return
    // sources list is mutated so we have to get the new index and mirror it to backend
    const base = sources.value[e.newIndex]
    if (base) {
      if (!base.order) {
        // empty update call to reorder bases (migration)
        await $api.base.update(base.project_id as string, base.id as string, {
          id: base.id,
          project_id: base.project_id,
        })
        message.info('Bases are migrated. Please try again.')
      } else {
        await $api.base.update(base.project_id as string, base.id as string, {
          id: base.id,
          project_id: base.project_id,
          order: e.newIndex + 1,
        })
      }
    }
    await loadProject(project.value.id as string, true)
    await loadBases()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const forceAwaken = () => {
  forceAwakened.value = !forceAwakened.value
  dataSourcesAwakened.value = forceAwakened.value
  emits('awaken', forceAwakened.value)
}

onMounted(async () => {
  if (sources.value.length === 0) {
    loadBases()
  }
})

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
            <div class="flex">New Source</div>
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
            <div class="ds-table-col ds-table-enabled cursor-pointer" @dblclick="forceAwaken">Visibility</div>
            <div class="ds-table-col ds-table-name">Name</div>
            <div class="ds-table-col ds-table-type">Type</div>
            <div class="ds-table-col ds-table-actions pl-2">Actions</div>
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
                        <template v-if="sources[0].enabled">Hide in UI</template>
                        <template v-else>Show in UI</template>
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
                    Default
                  </div>
                </div>

                <div class="ds-table-col ds-table-type">
                  <div class="flex items-center gap-1">-</div>
                </div>

                <div class="ds-table-col ds-table-actions">
                  <div class="flex items-center gap-2">
                    <a-button
                      v-if="!sources[0].is_meta && !sources[0].is_local"
                      class="nc-action-btn cursor-pointer outline-0"
                      type="text"
                      @click="baseAction(sources[0].id, DataSourcesSubTab.Metadata)"
                    >
                      <div class="flex items-center gap-2 text-gray-600">
                        <a-tooltip v-if="metadiffbases.includes(sources[0].id)">
                          <template #title>Out of sync</template>
                          <GeneralIcon icon="warning" class="group-hover:text-accent text-primary" />
                        </a-tooltip>
                        <GeneralIcon v-else icon="sync" class="group-hover:text-accent" />
                        Sync Metadata
                      </div>
                    </a-button>
                    <a-button
                      class="nc-action-btn cursor-pointer outline-0"
                      type="text"
                      @click="baseAction(sources[0].id, DataSourcesSubTab.ERD)"
                    >
                      <div class="flex items-center gap-2 text-gray-600">
                        <GeneralIcon icon="erd" class="group-hover:text-accent" />
                        Relations
                      </div>
                    </a-button>
                    <a-button
                      class="nc-action-btn cursor-pointer outline-0"
                      type="text"
                      @click="baseAction(sources[0].id, DataSourcesSubTab.UIAcl)"
                    >
                      <div class="flex items-center gap-2 text-gray-600">
                        <GeneralIcon icon="acl" class="group-hover:text-accent" />
                        UI ACL
                      </div>
                    </a-button>
                    <a-button
                      class="nc-action-btn cursor-pointer outline-0"
                      type="text"
                      @click="baseAction(sources[0].id, DataSourcesSubTab.Audit)"
                    >
                      <div class="flex items-center gap-2 text-gray-600">
                        <GeneralIcon icon="book" class="group-hover:text-accent" />
                        Audit
                      </div>
                    </a-button>
                  </div>
                </div>
                <div class="ds-table-col ds-table-crud">
                  <a-button
                    v-if="!sources[0].is_meta && !sources[0].is_local"
                    class="nc-action-btn cursor-pointer outline-0 !w-8 !px-1 !rounded-lg"
                    type="text"
                    @click="baseAction(sources[0].id, DataSourcesSubTab.Edit)"
                  >
                    <GeneralIcon icon="edit" class="text-gray-600" />
                  </a-button>
                </div>
              </div>
            </template>
            <template #item="{ element: base, index }">
              <div v-if="index !== 0" class="ds-table-row border-gray-200">
                <div class="ds-table-col ds-table-enabled">
                  <div class="flex items-center gap-1 cursor-pointer">
                    <a-tooltip>
                      <template #title>
                        <template v-if="base.enabled">Hide in UI</template>
                        <template v-else>Show in UI</template>
                      </template>
                      <a-switch :checked="base.enabled ? true : false" @change="toggleBase(base, $event)" />
                    </a-tooltip>
                  </div>
                </div>
                <div class="ds-table-col ds-table-name font-medium">
                  <GeneralIcon v-if="sources.length > 2" icon="dragVertical" small class="ds-table-handle" />
                  <div v-if="base.is_meta || base.is_local">-</div>
                  <div v-else class="flex items-center gap-1">
                    {{ base.is_meta || base.is_local ? 'BASE' : base.alias }}
                  </div>
                </div>

                <div class="ds-table-col ds-table-type">
                  <GeneralIcon v-if="sources.length > 2" icon="dragVertical" small class="ds-table-handle" />
                  <div class="flex items-center gap-2">
                    <GeneralBaseLogo :base-type="base.type" />
                    <span class="text-gray-700 capitalize">{{ base.type }}</span>
                  </div>
                </div>

                <div class="ds-table-col ds-table-actions">
                  <div class="flex items-center gap-2">
                    <a-button
                      class="nc-action-btn cursor-pointer outline-0"
                      type="text"
                      @click="baseAction(base.id, DataSourcesSubTab.ERD)"
                    >
                      <div class="flex items-center gap-2 text-gray-600">
                        <GeneralIcon icon="erd" class="group-hover:text-accent" />
                        Relations
                      </div>
                    </a-button>
                    <a-button
                      type="text"
                      class="nc-action-btn cursor-pointer outline-0"
                      @click="baseAction(base.id, DataSourcesSubTab.UIAcl)"
                    >
                      <div class="flex items-center gap-2 text-gray-600">
                        <GeneralIcon icon="acl" class="group-hover:text-accent" />
                        UI ACL
                      </div>
                    </a-button>
                    <a-button
                      v-if="!base.is_meta && !base.is_local"
                      type="text"
                      class="nc-action-btn cursor-pointer outline-0"
                      @click="baseAction(base.id, DataSourcesSubTab.Metadata)"
                    >
                      <div class="flex items-center gap-2 text-gray-600">
                        <a-tooltip v-if="metadiffbases.includes(base.id)">
                          <template #title>Out of sync</template>
                          <GeneralIcon icon="warning" class="group-hover:text-accent text-primary" />
                        </a-tooltip>
                        <GeneralIcon v-else icon="sync" class="group-hover:text-accent" />
                        Sync Metadata
                      </div>
                    </a-button>
                  </div>
                </div>
                <div class="ds-table-col ds-table-crud justify-end gap-x-1">
                  <a-button
                    v-if="!base.is_meta && !base.is_local"
                    class="nc-action-btn cursor-pointer outline-0 !w-8 !px-1 !rounded-lg mt-0.5"
                    type="text"
                    @click="baseAction(base.id, DataSourcesSubTab.Edit)"
                  >
                    <GeneralIcon icon="edit" class="text-gray-600 -mt-0.5" />
                  </a-button>
                  <a-button
                    v-if="!base.is_meta && !base.is_local"
                    class="nc-action-btn cursor-pointer outline-0 !w-8 !px-1 !rounded-lg mt-0.5"
                    type="text"
                    @click="openDeleteBase(base)"
                  >
                    <GeneralIcon icon="delete" class="text-red-500 -mt-0.5" />
                  </a-button>
                </div>
              </div>
            </template>
          </Draggable>
        </div>
      </div>
      <GeneralModal v-model:visible="isNewBaseModalOpen" size="medium">
        <div class="py-6 px-8">
          <CreateBase :connection-type="clientType" @base-created="loadBases(true)" @close="isNewBaseModalOpen = false" />
        </div>
      </GeneralModal>
      <GeneralModal v-model:visible="isErdModalOpen" size="large">
        <div
          class="p-6"
          :style="{
            height: '80vh',
          }"
        >
          <Erd :base-id="activeBaseId" />
        </div>
      </GeneralModal>
      <GeneralModal v-model:visible="isMetaDataModal" size="medium">
        <div class="p-6">
          <Metadata :base-id="activeBaseId" @base-synced="loadBases(true)" />
        </div>
      </GeneralModal>
      <GeneralModal v-model:visible="isUIAclModalOpen" class="!w-[60rem]">
        <div class="p-6">
          <UIAcl :base-id="activeBaseId" />
        </div>
      </GeneralModal>
      <GeneralModal v-model:visible="isEditBaseModalOpen" size="medium">
        <div class="p-6">
          <EditBase :base-id="activeBaseId" @base-updated="loadBases(true)" @close="isEditBaseModalOpen = false" />
        </div>
      </GeneralModal>
      <GeneralModal v-model:visible="isBaseAuditModalOpen" class="!w-[70rem]">
        <div class="p-6">
          <BaseAudit :base-id="activeBaseId" @close="isBaseAuditModalOpen = false" />
        </div>
      </GeneralModal>
      <GeneralDeleteModal v-model:visible="isDeleteBaseModalOpen" entity-name="base" :on-delete="deleteBase">
        <template #entity-preview>
          <div v-if="toBeDeletedBase" class="flex flex-row items-center py-2 px-3.25 bg-gray-50 rounded-lg text-gray-700 mb-4">
            <GeneralBaseLogo :base-type="toBeDeletedBase.type" />
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
  @apply flex items-center border-0 text-gray-400;
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
  @apply col-span-6 items-center capitalize;
}

.ds-table-type {
  @apply col-span-3 items-center;
}

.ds-table-actions {
  @apply col-span-7;
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
