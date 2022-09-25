<script setup lang="ts">
import { Empty } from 'ant-design-vue'
import type { BaseType } from 'nocodb-sdk'
import CreateBase from './data-sources/CreateBase.vue'
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

const { $api } = useNuxtApp()
const { project } = useProject()

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
                <a-tooltip>
                  <template #title>Sync Metadata {{ metadiffbases.includes(record.id) ? '(Out of sync)' : '' }}</template>
                  <MdiDatabaseSync
                    class="nc-action-btn cursor-pointer outline-0"
                    :class="metadiffbases.includes(record.id) ? 'text-primary' : ''"
                    @click="baseAction(record.id, DataSourcesSubTab.Metadata)"
                  />
                </a-tooltip>
                <a-tooltip>
                  <template #title>UI ACL</template>
                  <MdiDatabaseLockOutline
                    class="nc-action-btn cursor-pointer outline-0"
                    @click="baseAction(record.id, DataSourcesSubTab.UIAcl)"
                  />
                </a-tooltip>
                <a-tooltip>
                  <template #title>ERD</template>
                  <MdiGraphOutline
                    class="nc-action-btn cursor-pointer outline-0"
                    @click="baseAction(record.id, DataSourcesSubTab.ERD)"
                  />
                </a-tooltip>
                <a-tooltip>
                  <template #title>Edit</template>
                  <MdiEditOutline
                    class="nc-action-btn cursor-pointer outline-0"
                    @click="baseAction(record.id, DataSourcesSubTab.Edit)"
                  />
                </a-tooltip>
                <a-tooltip>
                  <template #title>Delete</template>
                  <MdiDeleteOutline class="nc-action-btn cursor-pointer outline-0" />
                </a-tooltip>
              </div>
            </template>
          </a-table-column>
        </a-table>
      </div>
      <div v-else-if="props.state === DataSourcesSubTab.New" class="max-h-600px overflow-y-auto">
        <CreateBase />
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
    </div>
  </div>
</template>
