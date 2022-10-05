<script setup lang="ts">
import { Empty } from 'ant-design-vue'
import type { BaseType } from 'nocodb-sdk'
import CreateBase from './data-sources/CreateBase.vue'
import EditBase from './data-sources/EditBase.vue'
import Metadata from './Metadata.vue'
import UIAcl from './UIAcl.vue'
import Erd from './Erd.vue'
import { DataSourcesSubTab } from '~/lib'
import { useNuxtApp, useProject } from '#imports'

interface Props {
  state: string
  reload: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:state', 'update:reload'])

const vModel = useVModel(props, 'state', emits)
const vReload = useVModel(props, 'reload', emits)

const { $api, $e } = useNuxtApp()
const { project, loadProject } = useProject()

let sources = $ref<BaseType[]>([])
let activeBaseId = $ref('')
let metadiffbases = $ref<string[]>([])

async function loadBases() {
  try {
    if (!project.value?.id) return

    vReload.value = true
    const baseList = await $api.base.list(project.value?.id)
    if (baseList.bases.list && baseList.bases.list.length) {
      sources = baseList.bases.list
    }
    loadMetaDiff()
  } catch (e) {
    console.error(e)
  } finally {
    vReload.value = false
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

const baseAction = (baseId: string, action: string) => {
  activeBaseId = baseId
  vModel.value = action
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

onMounted(async () => {
  if (sources.length === 0) {
    await loadBases()
  }
})

watch(
  () => props.reload,
  async (reload) => {
    if (reload) {
      await loadBases()
    }
  },
)
</script>

<template>
  <div class="flex flex-row w-full">
    <div class="flex flex-col w-full">
      <div v-if="props.state === ''" class="max-h-600px overflow-y-auto">
        <a-table
          class="w-full"
          size="small"
          :custom-row="
            (record) => ({
              class: `nc-datasource-row nc-datasource-row-${record.table_name}`,
            })
          "
          :data-source="sources ?? []"
          :pagination="false"
          :loading="vReload"
          bordered
        >
          <template #emptyText> <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" /> </template>
          <a-table-column key="alias" title="Name" data-index="alias">
            <template #default="{ text, record }">
              {{ record.is_meta ? 'BASE' : text }} <span class="text-gray-400 text-xs">({{ record.type }})</span>
            </template>
          </a-table-column>
          <a-table-column key="action" :title="$t('labels.actions')" :width="180">
            <template #default="{ record }">
              <div class="flex items-center gap-2">
                <a-button
                  class="nc-action-btn cursor-pointer outline-0"
                  @click="baseAction(record.id, DataSourcesSubTab.Metadata)"
                >
                  <div class="flex items-center gap-2 text-gray-600 font-light">
                    <a-tooltip v-if="metadiffbases.includes(record.id)">
                      <template #title>Out of sync</template>
                      <MdiDatabaseSync class="text-lg group-hover:text-accent text-primary" />
                    </a-tooltip>
                    <MdiDatabaseSync v-else class="text-lg group-hover:text-accent" />
                    Sync Metadata
                  </div>
                </a-button>
                <a-button class="nc-action-btn cursor-pointer outline-0" @click="baseAction(record.id, DataSourcesSubTab.UIAcl)">
                  <div class="flex items-center gap-2 text-gray-600 font-light">
                    <MdiDatabaseLockOutline class="text-lg group-hover:text-accent" />
                    UI ACL
                  </div>
                </a-button>
                <a-button class="nc-action-btn cursor-pointer outline-0" @click="baseAction(record.id, DataSourcesSubTab.ERD)">
                  <div class="flex items-center gap-2 text-gray-600 font-light">
                    <MdiGraphOutline class="text-lg group-hover:text-accent" />
                    ERD
                  </div>
                </a-button>
                <a-button
                  v-if="!record.is_meta"
                  class="nc-action-btn cursor-pointer outline-0"
                  @click="baseAction(record.id, DataSourcesSubTab.Edit)"
                >
                  <div class="flex items-center gap-2 text-gray-600 font-light">
                    <MdiEditOutline class="text-lg group-hover:text-accent" />
                    Edit
                  </div>
                </a-button>
                <a-button v-if="!record.is_meta" class="nc-action-btn cursor-pointer outline-0" @click="deleteBase(record)">
                  <div class="flex items-center gap-2 text-red-500 font-light">
                    <MdiDeleteOutline class="text-lg group-hover:text-accent" />
                    Delete
                  </div>
                </a-button>
              </div>
            </template>
          </a-table-column>
        </a-table>
      </div>
      <div v-else-if="props.state === DataSourcesSubTab.New" class="max-h-600px overflow-y-auto">
        <CreateBase @base-created="loadBases" />
      </div>
      <div v-else-if="props.state === DataSourcesSubTab.Metadata" class="max-h-600px overflow-y-auto">
        <Metadata :base-id="activeBaseId" />
      </div>
      <div v-else-if="props.state === DataSourcesSubTab.UIAcl" class="max-h-600px overflow-y-auto">
        <UIAcl :base-id="activeBaseId" />
      </div>
      <div v-else-if="props.state === DataSourcesSubTab.ERD" class="max-h-600px overflow-y-auto">
        <Erd :base-id="activeBaseId" />
      </div>
      <div v-else-if="props.state === DataSourcesSubTab.Edit" class="max-h-600px overflow-y-auto">
        <EditBase :base-id="activeBaseId" @base-updated="loadBases" />
      </div>
    </div>
  </div>
</template>
