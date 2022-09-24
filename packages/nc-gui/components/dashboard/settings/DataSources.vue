<script setup lang="ts">
import { Empty } from 'ant-design-vue'
import type { BaseType } from 'nocodb-sdk'
import CreateBase from './data-sources/CreateBase.vue'
import { useNuxtApp, useProject } from '#imports'

const { $api } = useNuxtApp()
const { project } = useProject()

let isLoading = $ref(false)
let sources = $ref<BaseType[]>([])
const newSourceTab = $ref(false)

async function loadBases() {
  try {
    if (!project.value?.id) return

    isLoading = true
    const baseList = await $api.base.list(project.value?.id)
    if (baseList.bases.list && baseList.bases.list.length) {
      sources = baseList.bases.list
    }
  } catch (e) {
    console.error(e)
  } finally {
    isLoading = false
  }
}

onMounted(async () => {
  if (sources.length === 0) {
    await loadBases()
  }
})
</script>

<template>
  <div class="flex flex-row w-full">
    <div class="flex flex-col w-full">
      <div class="flex flex-row justify-end items-center w-full mb-4">
        <a-button class="self-start nc-btn-new-datasource" @click="newSourceTab = !newSourceTab">
          <div v-if="newSourceTab" class="flex items-center gap-2 text-gray-600 font-light">
            <MdiClose class="text-lg group-hover:text-accent" />
            Cancel
          </div>
          <div v-else class="flex items-center gap-2 text-gray-600 font-light">
            <MdiDatabaseOutline class="text-lg group-hover:text-accent" />
            New
          </div>
        </a-button>
        <!--        Reload -->
        <a-button
          v-if="!newSourceTab"
          v-e="['a:proj-meta:meta-data:reload']"
          class="self-start nc-btn-metasync-reload"
          @click="loadBases"
        >
          <div class="flex items-center gap-2 text-gray-600 font-light">
            <MdiReload :class="{ 'animate-infinite animate-spin !text-success': isLoading }" />
            {{ $t('general.reload') }}
          </div>
        </a-button>
      </div>
      <div v-if="newSourceTab" class="max-h-600px overflow-y-auto">
        <CreateBase />
      </div>
      <div v-else class="max-h-600px overflow-y-auto">
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
          :loading="isLoading"
          bordered
        >
          <template #emptyText> <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" /> </template>
          <a-table-column key="type" title="Type" data-index="type" :width="180">
            <template #default="{ text }">{{ text }}</template>
          </a-table-column>
          <a-table-column key="alias" title="Name" data-index="alias">
            <template #default="{ text, record }">{{ record.is_meta ? 'BASE' : text }}</template>
          </a-table-column>
          <a-table-column key="action" :title="$t('labels.actions')" :width="180">
            <template #default="{ record }">
              <div class="flex items-center gap-2">
                <MdiEditOutline v-e="['c:base:edit:rename']" class="nc-action-btn" />

                <MdiDeleteOutline class="nc-action-btn" />
              </div>
            </template>
          </a-table-column>
        </a-table>
      </div>
    </div>
  </div>
</template>
