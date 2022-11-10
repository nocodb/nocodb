<script setup lang="ts">
import Draggable from 'vuedraggable'
import type { BaseType } from 'nocodb-sdk'
import CreateBase from './data-sources/CreateBase.vue'
import EditBase from './data-sources/EditBase.vue'
import Metadata from './Metadata.vue'
import UIAcl from './UIAcl.vue'
import Erd from './Erd.vue'
import { ClientType, DataSourcesSubTab } from '~/lib'
import { useNuxtApp, useProject } from '#imports'

interface Props {
  state: string
  reload: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:state', 'update:reload'])

const vState = useVModel(props, 'state', emits)
const vReload = useVModel(props, 'reload', emits)

const { $api, $e } = useNuxtApp()
const { project, loadProject } = useProject()

let sources = $ref<BaseType[]>([])
let activeBaseId = $ref('')
let metadiffbases = $ref<string[]>([])
let clientType = $ref<ClientType>(ClientType.MYSQL)
let isReloading = $ref(false)

async function loadBases() {
  try {
    if (!project.value?.id) return

    isReloading = true
    vReload.value = true
    const baseList = await $api.base.list(project.value?.id)
    if (baseList.bases.list && baseList.bases.list.length) {
      sources = baseList.bases.list
    }
  } catch (e) {
    console.error(e)
  } finally {
    vReload.value = false
    isReloading = false
  }
}

async function loadMetaDiff() {
  try {
    if (!project.value?.id) return

    metadiffbases = []

    const metadiff = await $api.project.metaDiffGet(project.value?.id)
    for (const model of metadiff) {
      if (model.detectedChanges?.length > 0) {
        metadiffbases.push(model.base_id)
      }
    }
  } catch (e) {
    console.error(e)
  }
}

const baseAction = (baseId?: string, action?: string) => {
  if (!baseId) return
  activeBaseId = baseId
  vState.value = action || ''
}

const deleteBase = (base: BaseType) => {
  $e('c:base:delete')

  Modal.confirm({
    title: `Do you want to delete '${base.alias}' project?`,
    wrapClassName: 'nc-modal-base-delete',
    okText: 'Yes',
    okType: 'danger',
    cancelText: 'No',
    async onOk() {
      try {
        await $api.base.delete(base.project_id as string, base.id as string)

        $e('a:base:delete')

        sources.splice(sources.indexOf(base), 1)
        await loadProject()
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

const toggleBase = async (base: BaseType, state: boolean) => {
  try {
    base.enabled = state
    await $api.base.update(base.project_id as string, base.id as string, {
      id: base.id,
      project_id: base.project_id,
      enabled: base.enabled,
    })
    await loadProject()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const moveBase = async (e: any) => {
  try {
    if (e.oldIndex === e.newIndex) return
    // sources list is mutated so we have to get the new index and mirror it to backend
    const base = sources[e.newIndex]
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
    await loadProject()
    await loadBases()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

onMounted(async () => {
  if (sources.length === 0) {
    await loadBases()
    await loadMetaDiff()
  }
})

watch(
  () => props.reload,
  async (reload) => {
    if (reload && !isReloading) {
      await loadBases()
      await loadMetaDiff()
    }
  },
)

watch(
  vState,
  (newState) => {
    switch (newState) {
      case ClientType.MYSQL:
        clientType = ClientType.MYSQL
        vState.value = DataSourcesSubTab.New
        break
      case ClientType.PG:
        clientType = ClientType.PG
        vState.value = DataSourcesSubTab.New
        break
      case ClientType.SQLITE:
        clientType = ClientType.SQLITE
        vState.value = DataSourcesSubTab.New
        break
      case ClientType.MSSQL:
        clientType = ClientType.MSSQL
        vState.value = DataSourcesSubTab.New
        break
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-row w-full">
    <div class="flex flex-col w-full overflow-auto">
      <div v-if="vState === ''" class="max-h-600px min-w-1200px overflow-y-auto">
        <div class="ds-table-head">
          <div class="ds-table-row">
            <div class="ds-table-col ds-table-name">Name</div>
            <div class="ds-table-col ds-table-actions">Actions</div>
            <div class="ds-table-col ds-table-enabled">Show / Hide</div>
          </div>
        </div>
        <div class="ds-table-body">
          <Draggable :list="sources" item-key="id" handle=".ds-table-handle" @end="moveBase">
            <template #header>
              <div v-if="sources[0]" class="ds-table-row border-gray-200">
                <div class="ds-table-col ds-table-name">
                  <div class="flex items-center gap-1">
                    <GeneralBaseLogo :base-type="sources[0].type" />
                    BASE
                    <span class="text-gray-400 text-xs">({{ sources[0].type }})</span>
                  </div>
                </div>

                <div class="ds-table-col ds-table-actions">
                  <div class="flex items-center gap-2">
                    <a-button
                      class="nc-action-btn cursor-pointer outline-0"
                      @click="baseAction(sources[0].id, DataSourcesSubTab.Metadata)"
                    >
                      <div class="flex items-center gap-2 text-gray-600 font-light">
                        <a-tooltip v-if="metadiffbases.includes(sources[0].id as string)">
                          <template #title>Out of sync</template>
                          <MdiDatabaseAlert class="text-lg group-hover:text-accent text-primary" />
                        </a-tooltip>
                        <MdiDatabaseSync v-else class="text-lg group-hover:text-accent" />
                        Sync Metadata
                      </div>
                    </a-button>
                    <a-button
                      class="nc-action-btn cursor-pointer outline-0"
                      @click="baseAction(sources[0].id, DataSourcesSubTab.UIAcl)"
                    >
                      <div class="flex items-center gap-2 text-gray-600 font-light">
                        <MdiDatabaseLockOutline class="text-lg group-hover:text-accent" />
                        UI ACL
                      </div>
                    </a-button>
                    <a-button
                      class="nc-action-btn cursor-pointer outline-0"
                      @click="baseAction(sources[0].id, DataSourcesSubTab.ERD)"
                    >
                      <div class="flex items-center gap-2 text-gray-600 font-light">
                        <MdiGraphOutline class="text-lg group-hover:text-accent" />
                        ERD
                      </div>
                    </a-button>
                    <a-button
                      v-if="!sources[0].is_meta"
                      class="nc-action-btn cursor-pointer outline-0"
                      @click="baseAction(sources[0].id, DataSourcesSubTab.Edit)"
                    >
                      <div class="flex items-center gap-2 text-gray-600 font-light">
                        <MdiEditOutline class="text-lg group-hover:text-accent" />
                        Edit
                      </div>
                    </a-button>
                  </div>
                </div>

                <div class="ds-table-col ds-table-enabled">
                  <div class="flex items-center gap-1 cursor-pointer">
                    <a-tooltip>
                      <template #title>
                        <template v-if="sources[0].enabled">Hide in UI</template>
                        <template v-else>Show in UI</template>
                      </template>
                      <MdiEyeSettings
                        v-if="sources[0].enabled"
                        class="text-lg text-primary outline-0"
                        @click="toggleBase(sources[0], false)"
                      ></MdiEyeSettings>
                      <MdiEyeSettingsOutline
                        v-else
                        class="text-lg text-red-500 outline-0"
                        @click="toggleBase(sources[0], true)"
                      ></MdiEyeSettingsOutline>
                    </a-tooltip>
                  </div>
                </div>
              </div>
            </template>
            <template #item="{ element: base, index }">
              <div v-if="index !== 0" class="ds-table-row border-gray-200">
                <div class="ds-table-col ds-table-name">
                  <MdiDragVertical small class="ds-table-handle" />
                  <div class="flex items-center gap-1">
                    <GeneralBaseLogo :base-type="base.type" />
                    {{ base.is_meta ? 'BASE' : base.alias }} <span class="text-gray-400 text-xs">({{ base.type }})</span>
                  </div>
                </div>

                <div class="ds-table-col ds-table-actions">
                  <div class="flex items-center gap-2">
                    <a-button
                      class="nc-action-btn cursor-pointer outline-0"
                      @click="baseAction(base.id, DataSourcesSubTab.Metadata)"
                    >
                      <div class="flex items-center gap-2 text-gray-600 font-light">
                        <a-tooltip v-if="metadiffbases.includes(base.id as string)">
                          <template #title>Out of sync</template>
                          <MdiDatabaseAlert class="text-lg group-hover:text-accent text-primary" />
                        </a-tooltip>
                        <MdiDatabaseSync v-else class="text-lg group-hover:text-accent" />
                        Sync Metadata
                      </div>
                    </a-button>
                    <a-button
                      class="nc-action-btn cursor-pointer outline-0"
                      @click="baseAction(base.id, DataSourcesSubTab.UIAcl)"
                    >
                      <div class="flex items-center gap-2 text-gray-600 font-light">
                        <MdiDatabaseLockOutline class="text-lg group-hover:text-accent" />
                        UI ACL
                      </div>
                    </a-button>
                    <a-button class="nc-action-btn cursor-pointer outline-0" @click="baseAction(base.id, DataSourcesSubTab.ERD)">
                      <div class="flex items-center gap-2 text-gray-600 font-light">
                        <MdiGraphOutline class="text-lg group-hover:text-accent" />
                        ERD
                      </div>
                    </a-button>
                    <a-button
                      v-if="!base.is_meta"
                      class="nc-action-btn cursor-pointer outline-0"
                      @click="baseAction(base.id, DataSourcesSubTab.Edit)"
                    >
                      <div class="flex items-center gap-2 text-gray-600 font-light">
                        <MdiEditOutline class="text-lg group-hover:text-accent" />
                        Edit
                      </div>
                    </a-button>
                    <a-button v-if="!base.is_meta" class="nc-action-btn cursor-pointer outline-0" @click="deleteBase(base)">
                      <div class="flex items-center gap-2 text-red-500 font-light">
                        <MdiDeleteOutline class="text-lg group-hover:text-accent" />
                        Delete
                      </div>
                    </a-button>
                  </div>
                </div>

                <div class="ds-table-col ds-table-enabled">
                  <div class="flex items-center gap-1 cursor-pointer">
                    <a-tooltip>
                      <template #title>
                        <template v-if="base.enabled">Hide in UI</template>
                        <template v-else>Show in UI</template>
                      </template>
                      <MdiEyeSettings
                        v-if="base.enabled"
                        class="text-lg text-primary outline-0"
                        @click="toggleBase(base, false)"
                      ></MdiEyeSettings>
                      <MdiEyeSettingsOutline
                        v-else
                        class="text-lg text-red-500 outline-0"
                        @click="toggleBase(base, true)"
                      ></MdiEyeSettingsOutline>
                    </a-tooltip>
                  </div>
                </div>
              </div>
            </template>
          </Draggable>
        </div>
      </div>
      <div v-else-if="vState === DataSourcesSubTab.New" class="max-h-600px overflow-y-auto">
        <CreateBase :connection-type="clientType" @base-created="loadBases" />
      </div>
      <div v-else-if="vState === DataSourcesSubTab.Metadata" class="max-h-600px overflow-y-auto">
        <Metadata :base-id="activeBaseId" @base-synced="loadBases" />
      </div>
      <div v-else-if="vState === DataSourcesSubTab.UIAcl" class="max-h-600px overflow-y-auto">
        <UIAcl :base-id="activeBaseId" />
      </div>
      <div v-else-if="vState === DataSourcesSubTab.ERD" class="max-h-600px overflow-y-auto">
        <Erd :base-id="activeBaseId" />
      </div>
      <div v-else-if="vState === DataSourcesSubTab.Edit" class="max-h-600px overflow-y-auto">
        <EditBase :base-id="activeBaseId" @base-updated="loadBases" />
      </div>
    </div>
  </div>
</template>

<style>
.ds-table-head {
  @apply flex items-center border-t bg-gray-100 font-bold text-gray-500;
}

.ds-table-body {
  @apply flex flex-col;
}

.ds-table-row {
  @apply grid grid-cols-20 border-b w-full h-full border-l border-r;
}

.ds-table-col {
  @apply flex items-center p-3 border-r-1 mr-2 h-50px;
}

.ds-table-enabled {
  @apply col-span-2 flex justify-center;
}

.ds-table-name {
  @apply col-span-9;
}

.ds-table-actions {
  @apply col-span-9;
}

.ds-table-col:last-child {
  @apply border-r-0;
}

.ds-table-handle {
  @apply cursor-pointer justify-self-start mr-2;
}
</style>
